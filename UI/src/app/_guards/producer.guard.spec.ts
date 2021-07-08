import { TestBed } from '@angular/core/testing';

import { ProducerGuard } from './producer.guard';

describe('ProducerGuard', () => {
  let guard: ProducerGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(ProducerGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
