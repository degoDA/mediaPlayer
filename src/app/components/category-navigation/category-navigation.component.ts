import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { CategoryItem } from '../../interfaces/category.interface';
import { MediaItem } from '../../interfaces/media.interface';

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
  @Output() titleChanged = new EventEmitter<string>();

  categories: CategoryItem[] = [];
  private uiSubscription!: Subscription;
  currentTitle: string = 'Categories';

  public playableMediaTypes: string[] = ['Track', 'Song', 'Station', 'PodcastEpisode', 'AudioBookChapter'];
  public browsableContainerTypes: string[] = ['Folder', 'Artist', 'Album', 'Playlist', 'Podcast', 'AudioBook', 'StationList'];

  constructor(
    private websocketService: WebsocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const cachedCategories = this.websocketService.lastProcessedCategories;
    const cachedParentName = this.websocketService.lastProcessedParentCategoryName;

    // console.log(`[CategoryNavigationComponent] ngOnInit - Initializing...`); // Removed

    if (cachedCategories && cachedCategories.length > 0) {
      this.categories = [...cachedCategories].sort((a: CategoryItem, b: CategoryItem) => {
        const nameA = a.browseItemName?.toLowerCase() || '';
        const nameB = b.browseItemName?.toLowerCase() || '';
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      if (cachedParentName && cachedParentName.trim() !== '') {
        this.currentTitle = cachedParentName;
        this.titleChanged.emit(this.currentTitle);
      }
      // console.log(`[CategoryNavigationComponent] Initialized with ${this.categories.length} categories from cache. Title: "${this.currentTitle}"`); // Removed
      this.cdr.detectChanges();
    } else {
      this.categories = [];
      // console.log('[CategoryNavigationComponent] No cached categories to initialize with, or cache was empty.'); // Removed
    }

    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      // console.log('[CategoryNavigationComponent] ngOnInit - newUIMessageData received by subscription:', JSON.stringify(data)); // Removed

      let categoriesChanged = false;
      let titleUpdatedBySubscription = false;

      if (data.type === 'categories' && data.categories && Array.isArray(data.categories)) {
        const sortedCategories = [...data.categories].sort((a: CategoryItem, b: CategoryItem) => {
          const nameA = a.browseItemName?.toLowerCase() || '';
          const nameB = b.browseItemName?.toLowerCase() || '';
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        });
        // Check if categories actually changed to avoid unnecessary re-render if only title changed
        if (JSON.stringify(this.categories) !== JSON.stringify(sortedCategories)) {
            this.categories = sortedCategories;
            categoriesChanged = true;
        }

        if (data.parentCategoryName && data.parentCategoryName.trim() !== '') {
          if (this.currentTitle !== data.parentCategoryName) {
            this.currentTitle = data.parentCategoryName;
            titleUpdatedBySubscription = true;
          }
        }
        // console.log(`[CategoryNavigationComponent] Updated with ${this.categories.length} categories from subscription. Title: "${this.currentTitle}"`); // Removed
      } else if (data.type === 'categories' && (data.categories === null || (Array.isArray(data.categories) && data.categories.length === 0))) {
        if (this.categories.length > 0) {
            categoriesChanged = true;
        }
        this.categories = [];

        if (data.parentCategoryName && data.parentCategoryName.trim() !== '') {
          const newTitle = data.parentCategoryName + " (empty)";
          if (this.currentTitle !== newTitle) {
            this.currentTitle = newTitle;
            titleUpdatedBySubscription = true;
          }
        }
        // console.log(`[CategoryNavigationComponent] Categories cleared or empty from subscription. Title: "${this.currentTitle}"`); // Removed
      }

      if (titleUpdatedBySubscription) {
          this.titleChanged.emit(this.currentTitle);
      }
      if (categoriesChanged || titleUpdatedBySubscription) {
          this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
  }

  selectCategory(category: CategoryItem): void {
    const mediaType = category.streamingMediaType?.toLowerCase();

    if (this.browsableContainerTypes.some(type => mediaType?.includes(type.toLowerCase()))) {
      this.websocketService.browseCategorie(category);
      this.categorySelected.emit(category);
      this.currentTitle = category.browseItemName;
      this.titleChanged.emit(this.currentTitle);
    }
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
      this.titleChanged.emit(this.currentTitle);
    }
    else {
      console.warn(`Unknown or ambiguous media type: ${category.streamingMediaType}. Attempting to browse.`);
      this.websocketService.browseCategorie(category);
      this.categorySelected.emit(category);
      this.currentTitle = category.browseItemName;
      this.titleChanged.emit(this.currentTitle);
    }
  }
}
