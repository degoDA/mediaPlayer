import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../../services/websocket.service';
import { Profile, Provider } from '../../../interfaces/profile.interface';

@Component({
  selector: 'app-profile-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-selection.component.html',
  styleUrls: ['./profile-selection.component.css']
})
export class ProfileSelectionComponent implements OnInit, OnDestroy {
  @Output() providerSelected = new EventEmitter<string>();
  profiles: Profile[] = [];
  private uiSubscription!: Subscription; // Definite assignment assertion

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe(data => {
      if (data && data.profiles) {
        this.profiles = data.profiles;
      }
    });
    // Request profiles when component initializes
    this.websocketService.streamingProviders();
  }

  ngOnDestroy(): void {
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
  }

  selectProvider(providerId: string | undefined): void {
    if (providerId) {
      this.providerSelected.emit(providerId);
      // Optionally, tell websocket service to browse this provider
      this.websocketService.browseProvider(providerId);
    } else {
      console.warn('selectProvider called with undefined providerId');
    }
  }
}
