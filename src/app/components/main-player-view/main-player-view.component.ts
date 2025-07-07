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
    // Ensure this.profiles is initialized if it's a class member being checked before WS response
    // It's not currently a class member of MainPlayerViewComponent, data.profiles is directly from subscription.

    this.websocketService.connect(environment.webSocketUrl, environment.webSocketProtocol);

    let initialCheckDone = false;
    this.currentHeaderTitle = 'Loading...'; // Initial transient title

    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      // Standard processing for notifications (should be present from previous implementation)
      if (data.hasOwnProperty('msgNotification')) {
        const notificationMsg = data.msgNotification;
        if (notificationMsg && typeof notificationMsg === 'string' && notificationMsg.trim() !== '') {
          this.currentNotification = notificationMsg;
          if (this.notificationTimeout) { clearTimeout(this.notificationTimeout); }
          this.notificationTimeout = setTimeout(() => {
            this.currentNotification = null;
            this.cdr.detectChanges();
          }, 7000);
          this.cdr.detectChanges();
        } else if (notificationMsg === null || (typeof notificationMsg === 'string' && notificationMsg.trim() === '')) {
          if (this.notificationTimeout) { clearTimeout(this.notificationTimeout); }
          this.currentNotification = null;
          this.cdr.detectChanges();
        }
      }
      // Note: Title changes from children are handled by onSubViewTitleChanged directly.

      // Startup Logic (runs until initialCheckDone is true)
      if (!initialCheckDone) {
        const currentNowPlaying = this.websocketService.mediaPlayerState?.nowPlayingData;
        // Use data.profiles if the current message contains profiles,
        // otherwise, this logic might run multiple times if other messages come first.
        // This implies profiles are expected to arrive via newUIMessageData.
        const profilesFromData = data.profiles; // Assuming data might be { profiles: Profile[] }

        if (currentNowPlaying?.trackTitle && currentNowPlaying.trackTitle.trim() !== '') {
          console.log('[MainPlayerView] Startup: Detected active playback. Navigating to NowPlayingScreen.');
          this.previousViewBeforeNowPlaying = 'profiles'; // Default previous view when starting in NowPlaying
          this.currentView = 'nowPlayingFullScreen';
          this.currentHeaderTitle = currentNowPlaying.trackTitle || currentNowPlaying.stationName || 'Now Playing';
          initialCheckDone = true;
          this.cdr.detectChanges();
        } else if (profilesFromData && Array.isArray(profilesFromData) && profilesFromData.length > 0) {
          // Only proceed if this message actually contains profiles
          console.log('[MainPlayerView] Startup: No active playback. Profiles loaded. Checking for last used profile.');
          const lastUsedProfileId = localStorage.getItem('lastUsedProfileId');
          const profileToSelect = lastUsedProfileId
            ? profilesFromData.find((p: Profile) => p.idProfile === lastUsedProfileId)
            : undefined;

          if (profileToSelect) {
            console.log('[MainPlayerView] Startup: Last used profile found:', profileToSelect.name);
            this.activeProfileIdForServiceView = profileToSelect.idProfile; // For ProfileSelectionComponent input
            this.activeProfileForSearchContext = profileToSelect; // For search context
            // The title will be set by ProfileSelectionComponent via titleChanged event
            // when it processes autoSelectProfileId and calls its selectProfile.
            // To set an immediate title:
            this.currentHeaderTitle = `Services for ${profileToSelect.name || 'Profile'}`;
          } else {
            console.log('[MainPlayerView] Startup: No valid last used profile found, or no lastUsedProfileId.');
            this.currentHeaderTitle = 'Select a Profile';
            this.activeProfileIdForServiceView = undefined;
            this.activeProfileForSearchContext = null;
          }
          this.currentView = 'profiles';
          initialCheckDone = true;
          this.cdr.detectChanges();
        }
        // If neither nowPlaying nor profiles are in this specific `data` message,
        // initialCheckDone remains false, and we wait for the next message.
      }
    });

    // Fallback timeout if no relevant initial data received quickly
    setTimeout(() => {
      if (!initialCheckDone) {
        console.log('[MainPlayerView] Startup: Timeout reached without initial state. Defaulting to profile selection view.');
        this.currentHeaderTitle = 'Select a Profile';
        this.currentView = 'profiles';
        this.activeProfileIdForServiceView = undefined;
        this.activeProfileForSearchContext = null;
        initialCheckDone = true;
        this.cdr.detectChanges();
      }
    }, 2500); // Increased timeout slightly to 2.5 seconds
  }

  onProviderSelected(data: { providerId: string, profile: Profile }): void {
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

  public onPlayableItemSelected(item: MediaItem | CategoryItem): void { // Make public if called from template directly
    console.log('[MainPlayerView] onPlayableItemSelected called with item:', JSON.stringify(item));

    // Determine the view before search was initiated or the view active when search was closed.
    // this.currentView at this point is the view that was active when FullScreenSearchComponent emitted.
    // If FullScreenSearchComponent was opened from 'profiles', currentView would be 'profiles'.
    // If opened from 'categories', currentView would be 'categories'.
    this.previousViewBeforeNowPlaying = this.currentView;
    this.currentView = 'nowPlayingFullScreen';

    let titleForItem: string | undefined;
    // Prioritize name from the item itself as mediaPlayerState might not be updated yet
    if ('browseItemName' in item && item.browseItemName) {
      titleForItem = item.browseItemName;
    } else if ('itemName' in item && (item as MediaItem).itemName) {
      titleForItem = (item as MediaItem).itemName;
    }
    // Fallback to station name from the item if it's a station and has that property directly
    // (CategoryItem and MediaItem interfaces don't currently define stationName directly, it's in NowPlayingData)
    // For now, the above is sufficient for most track/song items.

    this.currentHeaderTitle = titleForItem || 'Now Playing';
    console.log(`[MainPlayerView] Switched to nowPlayingFullScreen. Previous view: ${this.previousViewBeforeNowPlaying}. Header title set to: ${this.currentHeaderTitle}`);
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

  public switchToFullScreenPlayer(): void {
    // Check if there's actually something playing before switching
    if (this.websocketService.mediaPlayerState?.nowPlayingData &&
        this.websocketService.mediaPlayerState.nowPlayingData.trackTitle &&
        this.websocketService.mediaPlayerState.nowPlayingData.trackTitle.trim() !== '') {

      console.log('[MainPlayerView] Switching to full screen player. Current view:', this.currentView);
      this.previousViewBeforeNowPlaying = this.currentView;
      this.currentView = 'nowPlayingFullScreen';

      // Update header title based on current track, as user is focusing on it
      // This assumes nowPlayingData is populated when this is called.
      this.currentHeaderTitle = this.websocketService.mediaPlayerState.nowPlayingData.trackTitle ||
                                this.websocketService.mediaPlayerState.nowPlayingData.stationName ||
                                'Now Playing';
    } else {
      console.log('[MainPlayerView] Request to switch to full screen player, but no track data available.');
      // Optionally, briefly show a notification: "Nothing is playing."
      // For now, do nothing if no track is loaded.
    }
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
