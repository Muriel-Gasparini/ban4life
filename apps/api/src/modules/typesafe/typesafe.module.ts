import { Module } from '@nestjs/common';
import { TypeSafeService } from './typesafe.service';

@Module({
  providers: [TypeSafeService],
  exports: [TypeSafeService],
})
export class TypeSafeModule {}
