import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../../services/websocket.service';
import { CategoryItem } from '../../../interfaces/category.interface';
import { MediaItem } from '../../../interfaces/media.interface'; // Assuming MediaItem might be emitted

@Component({
  selector: 'app-category-navigation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-navigation.component.html',
  styleUrls: ['./category-navigation.component.css']
})
export class CategoryNavigationComponent implements OnInit, OnDestroy {
  @Input() currentProviderId?: string; // May not be directly used if ProfileSelection handles initial browse
  @Output() itemSelected = new EventEmitter<CategoryItem | MediaItem>();
  @Output() categorySelected = new EventEmitter<CategoryItem>();

  categories: CategoryItem[] = [];
  private uiSubscription!: Subscription;
  currentTitle: string = 'Categories'; // Default title

  // Basic check for "playable" types. This might need refinement.
  public playableMediaTypes: string[] = ['Track', 'Song', 'Station', 'PodcastEpisode', 'AudioBookChapter'];
  // Basic check for "browsable" container types. This might need refinement.
  public browsableContainerTypes: string[] = ['Folder', 'Artist', 'Album', 'Playlist', 'Podcast', 'AudioBook', 'StationList'];


  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe(data => {
      if (data && data.categories) {
        this.categories = data.categories;
        // Simple title update logic: if there are categories, try to use the providerKey of the first one.
        // This is a placeholder; a more robust solution might involve specific title properties from the backend.
        if (this.categories.length > 0 && this.categories[0].providerKey) {
          // A more descriptive title might come from a "parent" category if the backend provides it.
          // For now, using providerKey or a generic term.
          // this.currentTitle = `Content for ${this.categories[0].providerKey}`;
        } else if (!this.currentProviderId) {
          // this.currentTitle = 'Categories';
        }
      }
      // If ProfileSelectionComponent calls browseProvider, categories for that provider will be loaded.
      // If not, and currentProviderId is set, we might need an initial load here.
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
      this.currentTitle = category.browseItemName; // Update title to the selected category
    }
    // Else, if it's a directly playable type (like a Track or a Station)
    else if (this.playableMediaTypes.some(type => mediaType?.includes(type.toLowerCase()))) {
      // We assume CategoryItem has enough data for playback, or can be cast to MediaItem.
      // This might require mapping if structures are different.
      this.itemSelected.emit(category as MediaItem); // Casting, ensure compatibility
      this.websocketService.playback(category); // Tell service to play this item
    }
    // Fallback for types not explicitly handled: attempt to browse.
    else {
      console.warn(`Unknown or ambiguous media type: ${category.streamingMediaType}. Attempting to browse.`);
      this.websocketService.browseCategorie(category);
      this.categorySelected.emit(category);
      this.currentTitle = category.browseItemName;
    }
  }

  goBack(): void {
    this.websocketService.selectBackCategory();
    // Title update after going back might need to be handled by data received from websocketService,
    // or by managing a title history. For now, it will update when new categories are received.
  }

  // Helper to check if the back button should be disabled.
  // This is a simple check; a more robust solution might involve tracking browse depth.
  get isAtRootLevel(): boolean {
    // This is a placeholder. `this.websocketService.backCategory` is not directly accessible here.
    // We need a way for the component to know if a "back" operation is possible.
    // This could be a boolean flag updated by the websocket service or based on category depth.
    // For now, let's assume it's true if categories are empty or it's the initial load.
    // A more sophisticated check would involve the websocketService exposing state about back history.
    return this.websocketService.backCategory[0] === undefined;
  }
}
