import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Delivery } from './delivery.entity';

@Entity('delivery_attempts')
export class DeliveryAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Delivery, { nullable: false })
  @JoinColumn({ name: 'delivery_id' })
  delivery: Delivery;

  @Index()
  @Column('uuid', { name: 'delivery_id', nullable: false })
  deliveryId: string;

  @Column('int', { name: 'attempt_number' })
  attemptNumber: number;

  @Column('int', { name: 'status_code', nullable: true })
  statusCode: number | null;

  @Column('text', { nullable: true })
  error: string | null;

  @Column('int', { name: 'duration_ms' })
  durationMs: number;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'attempted_at',
  })
  attemptedAt: Date;
}
