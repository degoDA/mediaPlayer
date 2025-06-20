import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryItem } from '../../interfaces/category.interface'; // Assuming results are like CategoryItem
import { MediaItem } from '../../interfaces/media.interface';     // Or MediaItem

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './search-results.component.html',
  styleUrls: ['./search-results.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchResultsComponent {
  @Input() results: (CategoryItem | MediaItem)[] = [];
  @Input() isLoading: boolean = false;
  @Output() itemSelected = new EventEmitter<CategoryItem | MediaItem>();

  // Helper to determine item type if needed, though not strictly necessary if structure is compatible
  // isMediaItem(item: CategoryItem | MediaItem): item is MediaItem {
  //   return 'idMedia' in item;
  // }

  onSelectItem(item: CategoryItem | MediaItem): void {
    this.itemSelected.emit(item);
  }
}
