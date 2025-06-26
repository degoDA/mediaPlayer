import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'; // Added OnDestroy, ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment'; // Corrected import path

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
  activeProfileForSearchContext?: Profile | null; // Added property
  selectedPlayableItem?: MediaItem | CategoryItem;

  showFullScreenSearch: boolean = false;
  currentNotification: string | null = null;
  private notificationTimeout: any = null;
  private uiSubscription: any; // To hold the subscription

  constructor(
    public websocketService: WebsocketService,
    private cdr: ChangeDetectorRef
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
      this.activeProfileIdForServiceView = data.profile.idProfile; // Used by CategoryNavigation
      this.activeProfileForSearchContext = data.profile; // Set this for the new search input
    }
    this.currentView = 'categories';
    // ProfileSelectionComponent already calls browseProvider
    console.log('Provider selected in main view:', data.providerId);
  }

  onProfileContextUpdated(profile: Profile | null): void {
    this.activeProfileForSearchContext = profile;
    // If profile becomes null, maybe clear activeProfileIdForServiceView too if search should be disabled.
    // For now, this just updates the search context.
    // If going back to profiles list (profile is null), and then user selects a provider,
    // onProviderSelected will repopulate activeProfileForSearchContext.
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

  onReturnToServiceSelection(): void {
    // activeProfileIdForServiceView should still hold the ID of the profile whose services we want to see.
    // ProfileSelectionComponent will use this via its autoSelectProfileId input.
    this.currentView = 'profiles';
  }

  toggleFullScreenSearch(): void {
    this.showFullScreenSearch = !this.showFullScreenSearch;
  }
}
