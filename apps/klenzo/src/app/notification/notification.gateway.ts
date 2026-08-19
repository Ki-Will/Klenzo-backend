import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  // Map userId -> Set of socket IDs
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      // Try to extract JWT from query param or cookie
      const token =
        (client.handshake.query.token as string) ||
        this.extractCookie(client.handshake.headers.cookie, 'kz_at');

      if (token) {
        const payload = this.jwtService.verify(token);
        client.userId = payload.id;
        client.userEmail = payload.email;

        // Track this socket for the user
        if (!this.userSockets.has(payload.id)) {
          this.userSockets.set(payload.id, new Set());
        }
        this.userSockets.get(payload.id)!.add(client.id);

        this.logger.log(
          `🔌 WS connected: user=${payload.email} (id=${payload.id}), socket=${client.id}`,
        );
      } else {
        this.logger.warn(`WS connection without auth token: ${client.id}`);
      }
    } catch (err) {
      this.logger.warn(`WS auth failed: ${client.id}, error=${(err as Error).message}`);
      // Don't disconnect - allow anonymous connections for banners
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    if (client.userId && this.userSockets.has(client.userId)) {
      this.userSockets.get(client.userId)!.delete(client.id);
      if (this.userSockets.get(client.userId)!.size === 0) {
        this.userSockets.delete(client.userId);
      }
    }
    this.logger.log(`🔌 WS disconnected: ${client.id}`);
  }

  /**
   * Send a notification to a specific user via WebSocket.
   * If the user is connected, they receive it instantly.
   */
  sendToUser(userId: string, event: string, data: unknown): void {
    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.size > 0) {
      // Send to all sockets of this user (multiple tabs/devices)
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }

  /**
   * Broadcast to all connected users.
   */
  broadcastToAll(event: string, data: unknown): void {
    this.server.emit(event, data);
  }

  // ─── Client events ─────────────────────────────────────────────────────────

  @SubscribeMessage('markAsRead')
  handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ): void {
    // Forward to service via callback — handled in NotificationController
    this.logger.debug(`Client ${client.id} marks ${data.notificationId} as read`);
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(): { status: string } {
    return { status: 'ok' };
  }

  private extractCookie(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? match[1] : null;
  }
}
