export enum TyrePosition {
  FrontLeft = 'front_left',
  FrontRight = 'front_right',
  RearLeft = 'rear_left',
  RearRight = 'rear_right',
  Spare = 'spare',
  /** Two-wheelers (motorcycle/scooter) have one front tyre, not a left/right pair. */
  Front = 'front',
  /** Two-wheelers (motorcycle/scooter) have one rear tyre, not a left/right pair. */
  Rear = 'rear',
}
