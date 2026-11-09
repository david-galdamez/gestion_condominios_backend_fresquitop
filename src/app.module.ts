import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AreasModule } from '@Areas';
import { AuthModule } from '@Auth';
import { JwtAuthGuard, RolesGuard } from '@Auth/guards';
import { EstadoCuentaModule } from '@EstadoCuenta';
import { UnidadesModule } from '@Unidades';
import { AutorizacionesModule } from '@Autorizaciones';
import { MorosidadModule } from '@Morosidad';
import { HealthModule } from '@Health';
import { PaquetesModule } from '@Paquetes';
import { PrismaModule } from '@Prisma';
import { ReportesModule } from '@Reportes';
import { UsersModule } from '@Users';
import { validateEnv } from '@Config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    UsersModule,
    PaquetesModule,
    AuthModule,
    EstadoCuentaModule,
    UnidadesModule,
    AutorizacionesModule,
    MorosidadModule,
    AreasModule,     
    ReportesModule,  
  ],
  providers: [
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: RolesGuard,
    },
  ],
})
export class AppModule {}