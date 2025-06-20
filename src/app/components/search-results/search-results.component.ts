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

  // Add these methods to SearchResultsComponent class

  public getItemName(item: CategoryItem | MediaItem): string {
    // Using 'as any' for simplicity to access common-like properties after type narrowing via 'in' is too verbose for template.
    // This assumes that items will have one of these properties for their primary display name.
    if ('browseItemName' in item && item.browseItemName) {
      return item.browseItemName;
    }
    if ('itemName' in item && (item as MediaItem).itemName) {
      return (item as MediaItem).itemName!;
    }
    return 'Unknown Item';
  }

  public getItemType(item: CategoryItem | MediaItem): string | undefined {
    if ('streamingMediaType' in item && item.streamingMediaType) {
      return item.streamingMediaType;
    }
    if ('mediaType' in item && (item as MediaItem).mediaType) {
      return (item as MediaItem).mediaType!;
    }
    return undefined;
  }

  // urlIcon is optional on both CategoryItem (from mapping) and MediaItem (from interface def)
  // So direct access `item.urlIcon` in template with *ngIf should be fine.
  // However, to be consistent, a helper could be made:
  public getIconUrl(item: CategoryItem | MediaItem): string | undefined {
      return item.urlIcon;
  }
}
