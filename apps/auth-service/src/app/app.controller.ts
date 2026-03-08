import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { NatsSubjects, ValidateTokenRequest, ValidateTokenResponse } from '@klenzo/contracts';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @MessagePattern('auth.register')
  async register(@Payload() data: any) {
    return this.authService.register(data);
  }

  @MessagePattern('auth.login')
  async login(@Payload() data: any) {
    return this.authService.login(data);
  }

  // Handle Request/Reply for token validation from Gateway
  @MessagePattern(NatsSubjects.AUTH_VALIDATE_TOKEN)
  async validateToken(@Payload() data: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    return this.authService.validateToken(data.token);
  }
}
