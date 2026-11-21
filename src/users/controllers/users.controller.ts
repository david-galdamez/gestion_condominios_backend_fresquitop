import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '@Auth/decorators';
import { UsersService } from '@Users/services';
import { CreateUserDto, UserResponseDto } from '@Users/dto';
import { Rol } from '@PrismaClient';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Alta de usuarios: solo el administrador. Crear un usuario es crear un
   * recurso, así que es un POST a la colección `/users` y responde 201. El rol
   * siempre es RESIDENTE por defecto: no se acepta en el body.
   */
  @Roles(Rol.ADMINISTRADOR)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({
    summary: 'Da de alta un usuario (solo administrador)',
    description: 'El usuario queda con rol RESIDENTE; el rol no se acepta en el body.',
  })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'El nombre de usuario ya está en uso.' })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(dto);
    return UserResponseDto.fromEntity(user);
  }
}
