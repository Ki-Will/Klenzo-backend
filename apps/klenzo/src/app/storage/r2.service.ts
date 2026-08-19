import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class R2Service implements OnModuleInit {
  private s3: S3Client;
  private readonly logger = new Logger(R2Service.name);
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || 'klenzo-storage';
    // Use relative path by default to work with Next.js proxy
    const baseUrl =
      process.env.R2_PUBLIC_URL || '/storage';
    this.publicUrl = baseUrl.replace(/\/$/, '');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT_URL || 'http://localhost:9000',
      forcePathStyle: true, // Required for MinIO, ignored by R2
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucketName }));
      }
    }
    if (!process.env.R2_ENDPOINT_URL?.includes('cloudflare.com')) {
      await this.applyMinioPublicPolicy();
    }
  }

  private async applyMinioPublicPolicy() {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucketName}/*`],
        },
      ],
    };
    try {
      await this.s3.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucketName,
          Policy: JSON.stringify(policy),
        }),
      );
      this.logger.log('MinIO Public Policy Applied.');
    } catch (e) {
      this.logger.error(
        'Could not set bucket policy (might be R2 or permission issue)',
      );
    }
  }

  async uploadFile(
    file: any,
    folder: string = 'klenzo',
  ): Promise<string> {
    const fileExtension = file.originalname.split('.').pop() || 'png';
    const key = `${folder}/${randomUUID()}.${fileExtension}`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          // ACL: 'public-read' is the standard for S3/MinIO, but not supported by R2
          ...(process.env.R2_ENDPOINT_URL?.includes('cloudflare.com') ? {} : { ACL: ObjectCannedACL.public_read }),
        }),
      );

      return `${this.publicUrl}/${key}`;
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw error;
    }
  }
}
