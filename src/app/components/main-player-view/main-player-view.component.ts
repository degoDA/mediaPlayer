import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common'; // Location import removed
import { environment } from '../../../environments/environment';

// Assuming environment.ts exists and has these properties.
// In a real Angular app, this would be: import { environment } from '../../../environments/environment';
// const environment = {
//   production: false,
//   webSocketUrl: 'ws://localhost:8080/cresnext/client', // Example URL
//   webSocketProtocol: 'cresnext-api', // Example Protocol
//   clientId: 'AngularApp', // Example Client ID
//   profileKey: '', // Example Profile Key (might be set dynamically)
//   playerId: 'Player01' // Example Player ID
// };

import { ProfileSelectionComponent } from '../profile-selection/profile-selection.component';
import { CategoryNavigationComponent } from '../category-navigation/category-navigation.component';
import { PlayerComponent } from '../player/player.component';
import { WebsocketService } from '../../services/websocket.service';
import { MediaItem } from '../../interfaces/media.interface';
import { CategoryItem } from '../../interfaces/category.interface';
import { Profile } from '../../interfaces/profile.interface';
import { NotificationComponent } from '../notification/notification.component';
import { FullScreenSearchComponent } from '../full-screen-search/full-screen-search.component';
import { NowPlayingViewComponent } from '../now-playing-view/now-playing-view.component';

export type PlayerViewStates = 'profiles' | 'categories' | 'nowPlayingFullScreen'; // 'player' removed

@Component({
  selector: 'app-main-player-view',
  standalone: true,
  imports: [
    CommonModule,
    ProfileSelectionComponent,
    CategoryNavigationComponent,
    PlayerComponent, // Footer player
    NotificationComponent,
    FullScreenSearchComponent,
    NowPlayingViewComponent // Added
  ],
  templateUrl: './main-player-view.component.html',
  styleUrls: ['./main-player-view.component.css']
})
export class MainPlayerViewComponent implements OnInit, OnDestroy {
  currentView: PlayerViewStates = 'profiles'; // Using PlayerViewStates
  selectedProviderId?: string;
  activeProfileIdForServiceView?: string;
  activeProfileForSearchContext?: Profile | null;
  selectedPlayableItem?: MediaItem | CategoryItem;

  showFullScreenSearch: boolean = false;
  currentNotification: string | null = null;
  currentHeaderTitle: string = 'Select a Profile';
  private currentServiceName?: string;
  previousViewBeforeNowPlaying: PlayerViewStates = 'profiles'; // Using PlayerViewStates

  private notificationTimeout: any = null;
  private uiSubscription: any;

  constructor(
    public websocketService: WebsocketService,
    private cdr: ChangeDetectorRef
    // private location: Location // Removed location
  ) {}

  ngOnInit(): void {
    this.websocketService.connect(environment.webSocketUrl, environment.webSocketProtocol);

    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      // Existing logic for profiles, categories, player state would be here...
      // For example, if data.profiles exists, update this.profiles etc.
      // This example focuses on adding the msgNotification part.

      if (data.hasOwnProperty('msgNotification')) {
        const notificationMsg = data.msgNotification;
        if (notificationMsg && typeof notificationMsg === 'string' && notificationMsg.trim() !== '') {
          this.currentNotification = notificationMsg;
          this.cdr.detectChanges();

          if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
          }
          this.notificationTimeout = setTimeout(() => {
            this.currentNotification = null;
            this.cdr.detectChanges();
          }, 7000);
        } else if (notificationMsg === null || (typeof notificationMsg === 'string' && notificationMsg.trim() === '')) {
          if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
          }
          this.currentNotification = null;
          this.cdr.detectChanges();
        }
      }

      // Placeholder for other data processing from newUIMessageData
      if (data.profiles) { /* ... */ }
      if (data.categories) { /* ... */ }
      if (data.mediaPlayerState) { /* ... */ }
      if (data.connected) { /* ... */ }

    });
  }

  onProviderSelected(data: { providerId: string, profile: Profile }): void { // Signature updated
    this.selectedProviderId = data.providerId;
    if (data.profile && data.profile.idProfile) {
      this.activeProfileIdForServiceView = data.profile.idProfile;
      this.activeProfileForSearchContext = data.profile;

      const selectedProvider = data.profile.providers?.find(p => p.idService === data.providerId);
      this.currentServiceName = selectedProvider?.name;
      this.currentHeaderTitle = this.currentServiceName || 'Categories';
    }
    this.currentView = 'categories';
    console.log('Provider selected in main view:', data.providerId, 'Service name:', this.currentServiceName);
  }

  onProfileContextUpdated(profile: Profile | null): void {
    this.activeProfileForSearchContext = profile;
    if (!profile) { // Returned to main profile list
        this.currentHeaderTitle = 'Music Player'; // Default title
        this.currentServiceName = undefined;
        // activeProfileIdForServiceView is already undefined due to goAppBack logic
    } else {
        // Viewing services for a specific profile
        this.currentHeaderTitle = profile.name || 'Services'; // Title is profile name
        this.currentServiceName = undefined;
    }
  }

  onSubViewTitleChanged(title: string): void {
    // Only update if we are in a view that shows categories or profiles
    // (or player if it's showing category context, but nowPlayingFullScreen is separate)
    if (this.currentView === 'categories' || this.currentView === 'profiles') {
      this.currentHeaderTitle = title;
    }
  }

  ngOnDestroy(): void {
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout); // Clear timeout on component destroy
    }
  }

  onPlayableItemSelected(item: MediaItem | CategoryItem): void {
    // The playback command is already issued by CategoryNavigationComponent or FullScreenSearchComponent's onItemSelected
    // this.selectedPlayableItem = item; // This property might not be needed if NowPlayingViewComponent subscribes directly

    this.previousViewBeforeNowPlaying = this.currentView; // Store current view (e.g., 'categories', 'profiles' if search was done from there)
    this.currentView = 'nowPlayingFullScreen';
    console.log('[MainPlayerView] Switched to nowPlayingFullScreen. Previous view was:', this.previousViewBeforeNowPlaying);
  }

  // closeNowPlayingView(): void method removed

  onCategoryNavigation(category: CategoryItem): void {
    // This event signifies that navigation is happening within CategoryNavigationComponent.
    // The view should remain 'categories'.
    this.currentView = 'categories'; // Ensure view is categories
    console.log('Navigating to category in main view:', category.browseItemName);
  }

  // onReturnToServiceSelection(): void method removed

  toggleFullScreenSearch(): void {
    this.showFullScreenSearch = !this.showFullScreenSearch;
  }

  goAppBack(): void {
    console.log('[MainPlayerView] goAppBack called. Current view:', this.currentView);

    if (this.showFullScreenSearch) {
      this.toggleFullScreenSearch();
      console.log('[MainPlayerView] Closed full-screen search.');
      return;
    }

    if (this.currentView === 'nowPlayingFullScreen') {
      this.currentView = this.previousViewBeforeNowPlaying || 'categories'; // Fallback to 'categories' or 'profiles'
      console.log('[MainPlayerView] Exited nowPlayingFullScreen. Returning to:', this.currentView);
      if (this.currentView === 'profiles') {
          this.currentHeaderTitle = this.activeProfileForSearchContext
              ? `Services for ${this.activeProfileForSearchContext.name || 'Profile'}`
              : 'Select a Profile';
      } else if (this.currentView === 'categories') {
          this.currentHeaderTitle = this.currentServiceName || 'Categories'; // A sensible default
      }
      return;
    }

    if (this.currentView === 'categories') { // Changed from 'categories' || 'player'
      if (this.websocketService.selectBackCategory()) {
        console.log('[MainPlayerView] Navigated back within categories via WebsocketService.');
        this.currentView = 'categories';
        // Title will be updated by CategoryNavigationComponent via (titleChanged) if parentCategoryName is available
        return;
      } else {
        console.log('[MainPlayerView] No category history. Returning to profiles view to show services for profile:', this.activeProfileIdForServiceView);
        this.currentView = 'profiles';
        // Title will be set by ProfileSelectionComponent via (titleChanged) when it auto-selects
        return;
      }
    }

    if (this.currentView === 'profiles') {
      if (this.activeProfileIdForServiceView || this.activeProfileForSearchContext) {
        console.log('[MainPlayerView] In service list view. Returning to main profile list.');
        this.activeProfileIdForServiceView = undefined;
        this.activeProfileForSearchContext = null;
        this.currentHeaderTitle = 'Select a Profile';
        this.currentServiceName = undefined;
        // ProfileSelectionComponent's showProfiles() will emit the 'Select a Profile' title.
        return;
      } else {
        console.log('[MainPlayerView] At root profile list, no further in-app back action defined for now.');
      }
    }
  }
}
