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
  @Output() profileContextUpdated = new EventEmitter<Profile | null>();
  @Output() titleChanged = new EventEmitter<string>(); // Added
  @Input() selectedProfile?: Profile;
  profiles: Profile[] = [];
  servicesForSelectedProfile: Provider[] = [];
  private uiSubscription!: Subscription; // Definite assignment assertion

  constructor(private websocketService: WebsocketService) {}
  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      if (data.profiles && Array.isArray(data.profiles)) {
        this.profiles = data.profiles;
        // console.log('[ProfileSelectionComponent] Profiles received/updated. autoSelectProfileId:', this.autoSelectProfileId, 'Current selectedProfile:', this.selectedProfile?.idProfile); // Removed

        if (this.autoSelectProfileId && (!this.selectedProfile || this.selectedProfile.idProfile !== this.autoSelectProfileId)) {
          const profileToSelect = this.profiles.find(p => p.idProfile === this.autoSelectProfileId);
          if (profileToSelect) {
            // console.log('[ProfileSelectionComponent] Auto-selecting profile from autoSelectProfileId:', this.autoSelectProfileId); // Removed
            this.selectProfile(profileToSelect);
          } else {
            // console.log('[ProfileSelectionComponent] autoSelectProfileId provided but not found in profiles. Showing all profiles.'); // Removed
            if (this.selectedProfile) {
              this.showProfiles();
            } else {
              this.titleChanged.emit('Select a Profile');
            }
          }
        } else if (!this.selectedProfile && !this.autoSelectProfileId) {
          // console.log('[ProfileSelectionComponent] No autoSelect and no selectedProfile. Emitting default title.'); // Removed
          this.titleChanged.emit('Select a Profile');
        }
      }
    });

    if (this.profiles.length === 0) {
      // console.log('[ProfileSelectionComponent] No profiles on init, requesting streamingProviders.'); // Removed
      this.websocketService.streamingProviders();
    } else {
      // console.log('[ProfileSelectionComponent] Profiles already populated on init. Checking autoSelectProfileId.'); // Removed
      if (this.autoSelectProfileId && (!this.selectedProfile || this.selectedProfile.idProfile !== this.autoSelectProfileId)) {
        const profileToSelect = this.profiles.find(p => p.idProfile === this.autoSelectProfileId);
        if (profileToSelect) {
          // console.log('[ProfileSelectionComponent] Auto-selecting profile from pre-existing profiles cache.'); // Removed
          this.selectProfile(profileToSelect);
        } else {
           if (this.selectedProfile) {
              this.showProfiles();
           } else {
              this.titleChanged.emit('Select a Profile');
           }
        }
      } else if (!this.selectedProfile && !this.autoSelectProfileId) {
          this.titleChanged.emit('Select a Profile');
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
    if (profile.idProfile) {
      localStorage.setItem('lastUsedProfileId', profile.idProfile);
      // console.log(`[ProfileSelectionComponent] Stored lastUsedProfileId: ${profile.idProfile}`); // Removed
    }
    this.servicesForSelectedProfile = profile.providers || [];
    this.profileContextUpdated.emit(this.selectedProfile);
    this.titleChanged.emit(`Services for ${profile.name || 'Profile'}`);
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
    this.titleChanged.emit('Select a Profile'); // Added
    this.profileContextUpdated.emit(null);
    this.selectedProfile = undefined;
    this.servicesForSelectedProfile = [];
    // this.autoSelectProfileId = undefined; // Let parent control this input
  }
}
