import { Routes } from '@angular/router';
import { MainPlayerViewComponent } from './components/main-player-view/main-player-view.component';

export const routes: Routes = [
  { path: '', component: MainPlayerViewComponent, pathMatch: 'full' },
  // Potentially a wildcard redirect if other routes are not found
  // { path: '**', redirectTo: '' }
];
