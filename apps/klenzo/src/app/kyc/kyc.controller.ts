import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  @Get()
  async getKycStatus(@Req() req: any) {
    return {
      userId: req.user.id,
      tier: 'TIER_2',
      status: 'VERIFIED',
      verificationDate: new Date().toISOString(),
      documents: [
        { id: 'doc-1', type: 'PASSPORT', status: 'APPROVED', uploadedAt: new Date().toISOString() },
      ],
    };
  }

  @Post('documents')
  async submitDocument(
    @Req() req: any,
    @Body() dto: { documentType: string; documentNumber: string },
  ) {
    return {
      id: 'doc-' + Date.now(),
      userId: req.user.id,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      status: 'UNDER_REVIEW',
      submittedAt: new Date().toISOString(),
    };
  }
}
