import { BadRequestException, Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { CrearUnidadDto, UnidadResumenDto } from '@Unidades/dto';
import { UnidadRepository } from '@Unidades/repositories';
import { Prisma, Rol, type User } from '@PrismaClient';

@ApiTags('unidades')
@Controller('unidades')
export class UnidadesController {
  constructor(private readonly unidades: UnidadRepository) {}

  @Get()
  @Roles(Rol.SEGURIDAD, Rol.ADMINISTRADOR)
  @ApiOperation({ summary: 'Todas las unidades activas (selector de portería)' })
  @ApiOkResponse({ type: UnidadResumenDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  listar(): Promise<UnidadResumenDto[]> {
    return this.unidades.findActivas();
  }

  @Post()
  @Roles(Rol.ADMINISTRADOR)
  @ApiOperation({ summary: 'Da de alta una unidad (solo administrador)' })
  @ApiCreatedResponse({ type: UnidadResumenDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o la torre no existe.' })
  @ApiConflictResponse({ description: 'Ya existe una unidad con ese código.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  async crear(@Body() dto: CrearUnidadDto): Promise<UnidadResumenDto> {
    try {
      return await this.unidades.crear(dto.torreId, dto.codigo);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002: código duplicado. P2003: la torre no existe (FK).
        if (error.code === 'P2002') throw new ConflictException('Ya existe una unidad con ese código.');
        if (error.code === 'P2003') throw new BadRequestException('La torre no existe.');
      }
      throw error;
    }
  }

  @Get('mias')
  @Roles(Rol.RESIDENTE)
  @ApiOperation({ summary: 'Unidades del residente (para el selector)' })
  @ApiOkResponse({ type: UnidadResumenDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  mias(@CurrentUser() user: User): Promise<UnidadResumenDto[]> {
    return this.unidades.findDeUsuario(user.id);
  }
}
