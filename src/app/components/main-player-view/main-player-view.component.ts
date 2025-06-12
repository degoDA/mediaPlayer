import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// Assuming environment.ts exists and has these properties.
// In a real Angular app, this would be: import { environment } from '../../../environments/environment';
const environment = {
  production: false,
  webSocketUrl: 'ws://localhost:8080/cresnext/client', // Example URL
  webSocketProtocol: 'cresnext-api', // Example Protocol
  clientId: 'AngularApp', // Example Client ID
  profileKey: '', // Example Profile Key (might be set dynamically)
  playerId: 'Player01' // Example Player ID
};

import { ProfileSelectionComponent } from '../profile-selection/profile-selection.component';
import { CategoryNavigationComponent } from '../category-navigation/category-navigation.component';
import { PlayerComponent } from '../player/player.component';
import { WebsocketService } from '../../services/websocket.service';
import { MediaItem } from '../../interfaces/media.interface';
import { CategoryItem } from '../../interfaces/category.interface';

@Component({
  selector: 'app-main-player-view',
  standalone: true,
  imports: [
    CommonModule,
    ProfileSelectionComponent,
    CategoryNavigationComponent,
    PlayerComponent
  ],
  templateUrl: './main-player-view.component.html',
  styleUrls: ['./main-player-view.component.css']
})
export class MainPlayerViewComponent implements OnInit {
  currentView: 'profiles' | 'categories' | 'player' = 'profiles';
  // Alternative: use boolean flags for more complex layouts
  // showProfileSelection = true;
  // showCategoryNavigation = false;
  // showPlayer = false;

  selectedProviderId?: string;
  selectedPlayableItem?: MediaItem | CategoryItem;

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    // Connect to WebSocket server
    // Ensure that environment variables are correctly set in your actual environment files.
    this.websocketService.connect(environment.webSocketUrl, environment.webSocketProtocol);
  }

  onProviderSelected(providerId: string): void {
    this.selectedProviderId = providerId;
    this.currentView = 'categories';
    // ProfileSelectionComponent already calls browseProvider
    console.log('Provider selected in main view:', providerId);
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
}
