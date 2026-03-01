import { IsString, IsUrl, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStoryDto {
  @ApiProperty({
    description: 'Story title',
    example: 'Breaking: Major Tech Announcement',
  })
  @IsString()
  @Length(5, 500)
  title: string;

  @ApiProperty({
    description: 'Story URL',
    example: 'https://example.com/news/article',
  })
  @IsUrl()
  url: string;

  @ApiProperty({
    description: 'Story summary/content',
    required: false,
    example: 'A brief summary of the story...',
  })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiProperty({
    description: 'Source name',
    required: false,
    example: 'TechNews',
  })
  @IsString()
  @IsOptional()
  sourceName?: string;
}
