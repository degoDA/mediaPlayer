import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
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
  @Output() providerSelected = new EventEmitter<{ providerId: string, profile: Profile }>();
  @Input() autoSelectProfileId?: string;
  @Output() profileContextUpdated = new EventEmitter<Profile | null>(); // Added
  profiles: Profile[] = [];
  selectedProfile?: Profile;
  servicesForSelectedProfile: Provider[] = [];
  private uiSubscription!: Subscription; // Definite assignment assertion

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      if (data.profiles) {
        this.profiles = data.profiles;
        if (this.autoSelectProfileId && !this.selectedProfile) { // Check !this.selectedProfile to avoid re-selecting if already in service view
          const profileToSelect = this.profiles.find(p => p.idProfile === this.autoSelectProfileId);
          if (profileToSelect) {
            this.selectProfile(profileToSelect);
          }
        }
      }
    });

    // Initial fetch logic
    if (this.profiles.length === 0) { // Fetch if profiles are not loaded
        this.websocketService.streamingProviders();
    } else if (this.autoSelectProfileId && !this.selectedProfile) {
        // Profiles are loaded, but we need to auto-select and are not yet in service view
        const profileToSelect = this.profiles.find(p => p.idProfile === this.autoSelectProfileId);
        if (profileToSelect) {
          this.selectProfile(profileToSelect);
        }
    }
  }

  ngOnDestroy(): void {
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
  }

  selectProfile(profile: Profile): void {
    this.selectedProfile = profile;
    this.servicesForSelectedProfile = profile.providers || [];
    this.profileContextUpdated.emit(this.selectedProfile); // Added
    // this.autoSelectProfileId = undefined; // Let parent control this input
  }

  selectService(provider: Provider | undefined): void {
    if (provider && provider.idService && this.selectedProfile) { // Ensure selectedProfile is set
      this.providerSelected.emit({ providerId: provider.idService, profile: this.selectedProfile });
      this.websocketService.browseProvider(provider.idService);
    } else {
      console.warn('Attempted to select an undefined provider, provider with no idService, or selectedProfile is not set.');
    }
  }

  showProfiles(): void {
    this.profileContextUpdated.emit(null); // Added
    this.selectedProfile = undefined;
    this.servicesForSelectedProfile = [];
    // this.autoSelectProfileId = undefined; // Let parent control this input
  }
}
