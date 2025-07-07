import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core'; // Add ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // For ngModel
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { CategoryItem } from '../../interfaces/category.interface';
import { MediaItem } from '../../interfaces/media.interface';
import { Profile, Provider } from '../../interfaces/profile.interface'; // Added import
import { SearchResultsComponent } from '../search-results/search-results.component'; // To embed results
import { environment } from '../../../environments/environment'; // For fallback profileKey

@Component({
  selector: 'app-full-screen-search',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchResultsComponent],
  templateUrl: './full-screen-search.component.html',
  styleUrls: ['./full-screen-search.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FullScreenSearchComponent implements OnInit, OnDestroy {
  @Input() activeProfile?: Profile | null;
  @Output() closeSearch = new EventEmitter<void>();
  @Output() playableItemSelected = new EventEmitter<CategoryItem | MediaItem>(); // Added

  searchQuery: string = '';
  selectedSearchCategory: string = 'artist';
  searchCategories: string[] = ["artist", "song", "album", "station", "playlist", "podcastseries"];

  searchResults: (CategoryItem | MediaItem)[] = [];
  isLoading: boolean = false;
  showResults: boolean = false; // ADDED/ENSURED THIS LINE

  private uiSubscription?: Subscription;

  constructor(private websocketService: WebsocketService, private cdr: ChangeDetectorRef) {}

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
        this.showResults = true;
        this.cdr.detectChanges(); // ADD THIS LINE
      }
    });
  }

  onSearchSubmit(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      this.isLoading = false;
      return;
    }

    // Use activeProfile.idProfile or fallback to environment.profileKey
    const profileKeyToUse = this.activeProfile?.idProfile || environment.profileKey;

    if (!profileKeyToUse) {
      console.warn('[FullScreenSearchComponent] No profileKey available from activeProfile or environment for search.');
      this.isLoading = false;
      return;
    }

    // console.log(`[FullScreenSearchComponent] Searching for "${this.searchQuery}", category: "${this.selectedSearchCategory}", profile: "${profileKeyToUse}"`); // Removed
    this.isLoading = true;
    this.searchResults = [];
    this.websocketService.searchMedia(this.searchQuery.trim(), profileKeyToUse, this.selectedSearchCategory);
  }

  onItemSelected(item: CategoryItem | MediaItem): void {
    // console.log('[FullScreenSearchComponent] Item selected from search results:', item); // Removed

    let type: string | undefined;
    if ('streamingMediaType' in item && item.streamingMediaType) {
      type = item.streamingMediaType.toLowerCase();
    } else if ('mediaType' in item && (item as MediaItem).mediaType) {
      type = (item as MediaItem).mediaType!.toLowerCase();
    }

    let isPlayable = false;
    if (type === 'track' || type === 'song' || type === 'station') {
      isPlayable = true;
    } else if (!('browseKey' in item && item.browseKey && item.providerKey)) {
      // If it's not clearly browsable, assume it might be playable as a fallback
      isPlayable = true;
    }

    if (isPlayable) {
      this.websocketService.playback(item);
      this.playableItemSelected.emit(item); // Emit event
    } else { // Is browsable
       this.websocketService.browseCategorie(item as CategoryItem);
       // When browsing, MainPlayerView will automatically switch to 'categories'
       // because new category data will arrive, which CategoryNavigationComponent handles.
       // The title will also update via CategoryNavigationComponent.
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
