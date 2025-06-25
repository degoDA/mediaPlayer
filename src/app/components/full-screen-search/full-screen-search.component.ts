import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // For ngModel
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { CategoryItem } from '../../interfaces/category.interface';
import { MediaItem } from '../../interfaces/media.interface';
import { SearchResultsComponent } from '../search-results/search-results.component'; // To embed results
import { environment } from '../../../environments/environment'; // For fallback profileKey

@Component({
  selector: 'app-full-screen-search',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchResultsComponent],
  templateUrl: './full-screen-search.component.html',
  styleUrls: ['./full-screen-search.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush // Added as per prompt
})
export class FullScreenSearchComponent implements OnInit, OnDestroy {
  @Input() currentProfileKey?: string;
  @Output() closeSearch = new EventEmitter<void>();

  searchQuery: string = '';
  selectedSearchCategory: string = 'song'; // Default as per example
  searchCategories: string[] = ["artist", "song", "album", "station", "playlist", "podcastseries"];

  searchResults: (CategoryItem | MediaItem)[] = [];
  isLoading: boolean = false;

  private uiSubscription?: Subscription;

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      if (data.type === 'searchResults' && data.searchResults) {
        this.searchResults = [...data.searchResults].sort((a, b) => {
          const nameA = ((a as any).browseItemName || (a as MediaItem).itemName || '').toLowerCase();
          const nameB = ((b as any).browseItemName || (b as MediaItem).itemName || '').toLowerCase();
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        });
        this.isLoading = false;
      }
    });
  }

  onSearchSubmit(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults = []; // Clear results if query is empty
      this.isLoading = false; // Ensure loading is false if query is empty
      return;
    }

    const profileKeyToUse = this.currentProfileKey || environment.profileKey;
    if (!profileKeyToUse) {
      console.warn('[FullScreenSearchComponent] No profileKey available for search.');
      this.isLoading = false;
      return;
    }

    console.log(`[FullScreenSearchComponent] Searching for "${this.searchQuery}", category: "${this.selectedSearchCategory}", profile: "${profileKeyToUse}"`);
    this.isLoading = true;
    this.searchResults = [];
    this.websocketService.searchMedia(this.searchQuery.trim(), profileKeyToUse, this.selectedSearchCategory);
  }

  onItemSelected(item: CategoryItem | MediaItem): void {
    console.log('[FullScreenSearchComponent] Item selected from search results:', item);

    let type: string | undefined;
    if ('streamingMediaType' in item && item.streamingMediaType) {
      type = item.streamingMediaType.toLowerCase();
    } else if ('mediaType' in item && (item as MediaItem).mediaType) {
      type = (item as MediaItem).mediaType!.toLowerCase();
    }

    if (type === 'track' || type === 'song' || type === 'station') {
      this.websocketService.playback(item);
    } else {
      if ('browseKey' in item && item.browseKey && item.providerKey) {
         this.websocketService.browseCategorie(item as CategoryItem);
      } else {
        console.warn('[FullScreenSearchComponent] Selected item is not directly playable and lacks standard browse info. Attempting playback as fallback. Item:', item);
        this.websocketService.playback(item);
      }
    }
    this.close();
  }

  close(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.isLoading = false;
    this.closeSearch.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    this.close();
  }

  ngOnDestroy(): void {
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
  }
}
