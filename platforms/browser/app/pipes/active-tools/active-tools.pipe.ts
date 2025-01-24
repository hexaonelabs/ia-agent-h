import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'activeTools',
  standalone: true,
})
export class ActiveToolsPipe implements PipeTransform {
  transform(value: { selected: boolean }[]): { selected: boolean }[] {
    return value.filter((tool) => tool.selected);
  }
}
