import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsEmail, MaxLength } from "class-validator";

// Test-only DTOs. The Swagger CLI plugin transforms *.dto.ts, so these exercise
// the same metadata derivation as real DTOs without pinning a domain model.

export class CreateSampleDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class UpdateSampleDto extends PartialType(CreateSampleDto) {}

export class SampleDto {
  id!: number;
  email!: string;
}

export class SamplePageMetaDto {
  @ApiProperty({ type: "integer", nullable: true, example: 20 })
  nextCursor!: number | null;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;
}
