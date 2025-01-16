import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectUserModalComponent } from './connect-user-modal.component';

describe('ConnectUserModalComponent', () => {
  let component: ConnectUserModalComponent;
  let fixture: ComponentFixture<ConnectUserModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectUserModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConnectUserModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
