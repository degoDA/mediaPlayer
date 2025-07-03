import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { CategoryItem } from '../../interfaces/category.interface';
import { MediaItem } from '../../interfaces/media.interface'; // Assuming MediaItem might be emitted

@Component({
  selector: 'app-category-navigation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-navigation.component.html',
  styleUrls: ['./category-navigation.component.css']
})
export class CategoryNavigationComponent implements OnInit, OnDestroy {
  @Input() currentProviderId?: string;
  @Output() itemSelected = new EventEmitter<CategoryItem | MediaItem>();
  @Output() categorySelected = new EventEmitter<CategoryItem>();
  @Output() titleChanged = new EventEmitter<string>(); // Added
  // @Output() returnToServiceSelection = new EventEmitter<void>(); // Removed

  categories: CategoryItem[] = [];
  private uiSubscription!: Subscription;
  currentTitle: string = 'Categories'; // Default title

  // Basic check for "playable" types. This might need refinement.
  public playableMediaTypes: string[] = ['Track', 'Song', 'Station', 'PodcastEpisode', 'AudioBookChapter'];
  // Basic check for "browsable" container types. This might need refinement.
  public browsableContainerTypes: string[] = ['Folder', 'Artist', 'Album', 'Playlist', 'Podcast', 'AudioBook', 'StationList'];


  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      // The data object will now be { categories: CategoryItem[], parentCategoryName?: string, type?: 'categories' }
      if (data.type === 'categories' && data.categories && Array.isArray(data.categories)) {
        const sortedCategories = [...data.categories].sort((a: CategoryItem, b: CategoryItem) => {
          const nameA = a.browseItemName?.toLowerCase() || '';
          const nameB = b.browseItemName?.toLowerCase() || '';
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        });
        this.categories = sortedCategories;

        if (data.parentCategoryName && data.parentCategoryName.trim() !== '') {
             this.currentTitle = data.parentCategoryName;
             this.titleChanged.emit(this.currentTitle);
        } else {
            // This is the root category list for a service.
            // MainPlayerViewComponent has already set the title to the service name.
            // Do not change or emit title here to avoid overriding it.
            // If currentTitle was a sub-category, and now we are at root (e.g. user selected new provider),
            // MainPlayerView will handle setting the new service name as title.
        }
      } else if (data.type === 'categories' && (data.categories === null || (Array.isArray(data.categories) && data.categories.length === 0))) {
        this.categories = [];
        // If a parent category name exists, it means we are in an empty sub-category.
        if (data.parentCategoryName && data.parentCategoryName.trim() !== '') {
            this.currentTitle = data.parentCategoryName; // Title is the parent we are "in"
            this.titleChanged.emit(this.currentTitle + " (empty)"); // Indicate it's empty
        }
        // If no parentCategoryName, it's an empty root list for a service, title handled by MainPlayerView.
      }
      // For now, assuming ProfileSelectionComponent triggers the first load.
    });
  }

  ngOnDestroy(): void {
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
  }

  selectCategory(category: CategoryItem): void {
    // Normalize streamingMediaType for comparison
    const mediaType = category.streamingMediaType?.toLowerCase();

    // Check if the type is explicitly browsable (e.g., Album, Artist, Playlist which can also be "played" directly)
    // or if it's a generic type that isn't immediately playable (needs further browsing).
    // The definition of "playable" vs "browsable" can be tricky.
    // An Album can be "played" (play all tracks) or "browsed" (view tracks).
    // For simplicity, we assume specific types are for browsing deeper.

    // Example: If it's an Artist, Album, Playlist, or a generic Folder, browse deeper.
    if (this.browsableContainerTypes.some(type => mediaType?.includes(type.toLowerCase()))) {
      this.websocketService.browseCategorie(category);
      this.categorySelected.emit(category);
      this.currentTitle = category.browseItemName;
      this.titleChanged.emit(this.currentTitle); // Emit title change
    }
    // Else, if it's a directly playable type (like a Track or a Station)
    else if (this.playableMediaTypes.some(type => mediaType?.includes(type.toLowerCase()))) {
      const finalProviderKey = category.providerKey || this.currentProviderId;

      if (!finalProviderKey) {
        console.error('[CategoryNavigationComponent] Cannot determine providerKey for playable item. Category lacks providerKey and currentProviderId is not set. Item:', JSON.stringify(category));
        return;
      }

      const playableItem: MediaItem = {
        idMedia: category.idCategorie,
        itemName: category.browseItemName,
        signedData: category.signedData,
        urlIcon: category.urlIcon,
        browseKey: category.browseKey,
        providerKey: finalProviderKey,
        mediaType: category.streamingMediaType
      };

      this.itemSelected.emit(playableItem);
      this.websocketService.playback(playableItem);
      this.currentTitle = playableItem.itemName;
      this.titleChanged.emit(this.currentTitle); // Emit title change
    }
    // Fallback for types not explicitly handled: attempt to browse.
    else {
      console.warn(`Unknown or ambiguous media type: ${category.streamingMediaType}. Attempting to browse.`);
      this.websocketService.browseCategorie(category);
      this.categorySelected.emit(category);
      this.currentTitle = category.browseItemName;
      this.titleChanged.emit(this.currentTitle); // Emit title change
    }
  }

  // goBack(): void method removed
  // isAtRootLevel getter removed
}
