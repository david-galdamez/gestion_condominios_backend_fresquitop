import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { UserRepository } from '@Users/repositories';
import { EmailAlreadyTakenError } from '@Users/errors';
import { UnidadRepository } from '@Unidades/repositories';
import type { CreateUserDto } from '@Users/dto';
import type { EnvConfig } from '@Config';
import type { User } from '@PrismaClient';

/**
 * Lógica de negocio de usuarios.
 *
 * No conoce Prisma: todo el acceso a datos pasa por UserRepository.
 */
@Injectable()
export class UsersService {
  private readonly saltRounds: number;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly unidadRepository: UnidadRepository,
    configService: ConfigService<EnvConfig, true>,
  ) {
    this.saltRounds = configService.get('BCRYPT_SALT_ROUNDS', { infer: true });
  }

  async create({ email, password, nombre, unidadIds = [] }: CreateUserDto): Promise<User> {
    await this.validarUnidades(unidadIds);
    const passwordHash = await this.hashPassword(password);

    try {
      return await this.userRepository.create({ email, passwordHash, nombre, unidadIds });
    } catch (error) {
      // Traduce el error de dominio del repositorio a una excepción HTTP.
      if (error instanceof EmailAlreadyTakenError) {
        throw new ConflictException('El email ya está registrado.');
      }
      throw error;
    }
  }

  /** Todas las unidades deben existir y estar activas; si no, 400 antes de crear nada. */
  private async validarUnidades(unidadIds: string[]): Promise<void> {
    if (unidadIds.length === 0) return;
    const validas = await this.unidadRepository.findActivasByIds(unidadIds);
    if (validas.length !== unidadIds.length) {
      throw new BadRequestException('Alguna de las unidades no existe o no está activa.');
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
