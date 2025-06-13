import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { Profile, Provider } from '../../interfaces/profile.interface';

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
  selectedProfile?: Profile;
  servicesForSelectedProfile: Provider[] = [];
  private uiSubscription!: Subscription; // Definite assignment assertion

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
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

  selectProfile(profile: Profile): void {
    this.selectedProfile = profile;
    this.servicesForSelectedProfile = profile.providers || [];
  }

  selectService(provider: Provider | undefined): void {
    if (provider && provider.idService) {
      this.providerSelected.emit(provider.idService);
      this.websocketService.browseProvider(provider.idService);
    } else {
      console.warn('Attempted to select an undefined provider or provider with no idService.');
    }
  }

  showProfiles(): void {
    this.selectedProfile = undefined;
    this.servicesForSelectedProfile = [];
  }
}
