import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { CategoryItem } from '../../interfaces/category.interface';
import { MediaItem } from '../../interfaces/media.interface';
import { SearchInputComponent } from '../search-input/search-input.component';
import { SearchResultsComponent } from '../search-results/search-results.component';
import { environment } from '../../../environments/environment'; // For potential fallback profileKey

@Component({
  selector: 'app-search-container',
  standalone: true,
  imports: [CommonModule, SearchInputComponent, SearchResultsComponent],
  templateUrl: './search-container.component.html',
  styleUrls: ['./search-container.component.css']
})
export class SearchContainerComponent implements OnInit, OnDestroy {
  @Input() currentProfileKey?: string;

  searchResults: (CategoryItem | MediaItem)[] = [];
  isLoading: boolean = false;
  showResults: boolean = false;

  private uiSubscription?: Subscription;

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      if (data.type === 'searchResults' && data.searchResults) {
        this.searchResults = [...data.searchResults].sort((a, b) => {
          const nameA = (a.browseItemName || (a as MediaItem).itemName || '').toLowerCase();
          const nameB = (b.browseItemName || (b as MediaItem).itemName || '').toLowerCase();
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        });
        this.isLoading = false;
        this.showResults = true;
      }
    });
  }

  handleSearchQuery(query: string): void {
    const profileKeyToUse = this.currentProfileKey || environment.profileKey;

    if (!profileKeyToUse) {
      console.warn('[SearchContainerComponent] No profileKey available (neither @Input currentProfileKey nor environment.profileKey). Cannot perform search.');
      // Optionally, display a message to the user, e.g., by setting a component property
      // this.userMessage = "Please select a profile before searching.";
      // Or emit an event upwards if the parent needs to handle this (e.g., prompt profile selection)
      return;
    }
    console.log('[SearchContainerComponent] Search query:', query, 'ProfileKey:', profileKeyToUse);
    this.isLoading = true;
    this.searchResults = [];
    this.showResults = true;
    this.websocketService.searchMedia(query, profileKeyToUse, 'song'); // Default 'song', could be configurable
  }

  handleItemSelected(item: CategoryItem | MediaItem): void {
    console.log('[SearchContainerComponent] Item selected:', item);

    let type: string | undefined;
    if ('streamingMediaType' in item && item.streamingMediaType) {
      // It's likely a CategoryItem or has CategoryItem-like properties
      type = item.streamingMediaType.toLowerCase();
    } else if ('mediaType' in item && (item as MediaItem).mediaType) {
      // It's likely a MediaItem or has MediaItem-like properties
      // Need to cast to MediaItem here if mediaType is specific to it and not on CategoryItem
      type = (item as MediaItem).mediaType!.toLowerCase();
    }
    // 'type' will be undefined if neither property is found or if they are null/empty

    if (type === 'track' || type === 'song' || type === 'station') {
      this.websocketService.playback(item);
    } else {
      console.warn('[SearchContainerComponent] Browsing from search results for non-track/song/station types needs robust integration. Item:', item);
      if ('browseKey' in item && item.browseKey && item.providerKey) {
         this.websocketService.browseCategorie(item as CategoryItem);
         // Potentially emit event to parent to switch view to category navigation
      } else {
        // Fallback: attempt to play even if not explicitly a track/song/station,
        // if it has necessary playback info.
        this.websocketService.playback(item);
      }
    }
    this.showResults = false;
  }

  ngOnDestroy(): void {
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
  }
}
