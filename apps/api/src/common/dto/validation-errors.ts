import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export function validationException(errors: ValidationError[]) {
  const fields: Record<string, string> = {};
  function visit(items: ValidationError[], prefix = '') {
    for (const item of items) {
      const path = prefix ? `${prefix}.${item.property}` : item.property;
      if (item.constraints) fields[path] = Object.values(item.constraints)[0];
      if (item.children) visit(item.children, path);
    }
  }
  visit(errors);
  return new BadRequestException({ message: 'Vui lòng kiểm tra các trường được đánh dấu.', fields });
}
