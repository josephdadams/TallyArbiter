import { TestBed } from '@angular/core/testing';

import { WakeLockService } from './wake-lock.service';

describe('WakeLockService', () => {
  let service: WakeLockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WakeLockService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
