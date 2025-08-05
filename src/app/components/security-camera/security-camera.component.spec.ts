import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SecurityCameraComponent } from './security-camera.component';

describe('SecurityCameraComponent', () => {
  let component: SecurityCameraComponent;
  let fixture: ComponentFixture<SecurityCameraComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityCameraComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SecurityCameraComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
