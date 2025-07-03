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
import { FullScreenSearchComponent } from '../full-screen-search/full-screen-search.component'; // Added import

@Component({
  selector: 'app-main-player-view',
  standalone: true,
  imports: [
    CommonModule,
    ProfileSelectionComponent,
    CategoryNavigationComponent,
    PlayerComponent,
    NotificationComponent,
    FullScreenSearchComponent // Added FullScreenSearchComponent
  ],
  templateUrl: './main-player-view.component.html',
  styleUrls: ['./main-player-view.component.css']
})
export class MainPlayerViewComponent implements OnInit, OnDestroy { // Implemented OnDestroy
  currentView: 'profiles' | 'categories' | 'player' = 'profiles';
  selectedProviderId?: string;
  activeProfileIdForServiceView?: string;
  activeProfileForSearchContext?: Profile | null;
  selectedPlayableItem?: MediaItem | CategoryItem;

  showFullScreenSearch: boolean = false;
  currentNotification: string | null = null;
  currentHeaderTitle: string = 'Select a Profile'; // Changed initial title
  private currentServiceName?: string;
  private notificationTimeout: any = null;
  private uiSubscription: any; // To hold the subscription

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

  onSubViewTitleChanged(title: string): void { // Renamed method
    // Only update if we are in a view that shows categories, player, or profiles
    // ProfileSelectionComponent now also emits titles.
    if (this.currentView === 'categories' || this.currentView === 'player' || this.currentView === 'profiles') {
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
    this.selectedPlayableItem = item;
    // CategoryNavigationComponent already calls playback
    this.currentView = 'player'; // Or keep it 'categories' and player is just active
    console.log('Playable item selected in main view:', item);
    // Depending on layout, player might always be visible, or become prominent here.
  }

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
    console.log('[MainPlayerView] goAppBack called. Current view:', this.currentView, 'Active profile for search/service:', this.activeProfileForSearchContext?.idProfile);

    if (this.showFullScreenSearch) {
      this.toggleFullScreenSearch(); // Close search overlay first
      console.log('[MainPlayerView] Closed full-screen search.');
      return;
    }

    if (this.currentView === 'categories' || this.currentView === 'player') { // 'player' view often shows categories too
      if (this.websocketService.selectBackCategory()) {
        // WebsocketService handled back navigation within categories.
        // The UI will update via its subscription to newUIMessageData,
        // which should set this.currentView = 'categories' if still in categories.
        console.log('[MainPlayerView] Navigated back within categories via WebsocketService.');
        // Ensure view is set to categories if a category back action was successful
        // This might be important if currentView was 'player'
        this.currentView = 'categories';
        return;
      } else {
        // No more category history in WebsocketService.
        // This means we were at the root of a service's categories.
        // Goal: Go back to showing the service list for the active profile.
        console.log('[MainPlayerView] No category history. Returning to profiles view to show services for profile:', this.activeProfileIdForServiceView);
        // ProfileSelectionComponent will emit "Services for <ProfileName>" via its titleChanged event
        // when it auto-selects the profile. So, no need to set currentHeaderTitle here directly.
        // Just ensure currentView is set, and ProfileSelectionComponent handles the rest.
        this.currentView = 'profiles';
        // currentServiceName is already undefined or will be set by ProfileSelection if a specific service context is implied.
        return;
      }
    }

    if (this.currentView === 'profiles') {
      if (this.activeProfileIdForServiceView || this.activeProfileForSearchContext) {
        console.log('[MainPlayerView] In service list view. Returning to main profile list.');
        this.activeProfileIdForServiceView = undefined;
        this.activeProfileForSearchContext = null;
        // ProfileSelectionComponent's showProfiles() should have emitted 'Select a Profile' title.
        // So, currentHeaderTitle should be updated via onSubViewTitleChanged.
        // Explicitly setting here is a fallback or can be primary if preferred.
        this.currentHeaderTitle = 'Select a Profile';
        this.currentServiceName = undefined;
        return;
      } else {
        console.log('[MainPlayerView] At root profile list, no further in-app back action defined for now.');
        // Title should already be 'Select a Profile' if this is the case from initial load or previous back.
      }
    }
  }
}
