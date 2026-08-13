import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Message } from './message.entity';
import { Endpoint } from './endpoint.entity';
import { DeliveryAttempt } from './delivery-attempt.entity';

@Unique(['messageId', 'endpointId'])
@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message, { nullable: false })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Column('uuid', { name: 'message_id', nullable: false })
  messageId: string;

  @ManyToOne(() => Endpoint, { nullable: false })
  @JoinColumn({ name: 'endpoint_id' })
  endpoint: Endpoint;

  @Column('uuid', { name: 'endpoint_id', nullable: false })
  endpointId: string;

  @Column('text')
  status: DeliveryStatus;

  @Column('int', { name: 'attempt_count', default: 0 })
  attemptCount: number;

  @Column('timestamptz', { name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => DeliveryAttempt, (da) => da.deliveryId)
  deliveryAttempt: DeliveryAttempt;
}

export type DeliveryStatus = 'pending' | 'delivering' | 'delivered' | 'failed';
