import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // Added RouterModule
// MainPlayerViewComponent is no longer directly imported by AppComponent
// import { MainPlayerViewComponent } from './components/main-player-view/main-player-view.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule], // MainPlayerViewComponent removed, RouterModule added
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  // All previous properties and methods are removed as their responsibilities
  // have been moved to MainPlayerViewComponent and its children.

  constructor() {
    // WebsocketService connection is now handled by MainPlayerViewComponent
  }

  ngOnInit(): void {
    // Initialization logic previously here is now in MainPlayerViewComponent
  }

  // All other methods (send, selectSreaming, etc.) are removed.
}
