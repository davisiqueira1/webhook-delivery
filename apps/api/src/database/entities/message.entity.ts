import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Application } from './application.entity';
import { Delivery } from './delivery.entity';

@Unique(['applicationId', 'idempotencyKey'])
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Application, { nullable: false })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @Column('uuid', { name: 'application_id', nullable: false })
  applicationId: string;

  @Column('text', { name: 'event_type' })
  eventType: string;

  @Column('jsonb')
  payload: object;

  @Column('text', { name: 'idempotency_key', nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
  })
  createdAt: Date;

  @OneToMany(() => Delivery, (d) => d.messageId)
  delivery: Delivery[];
}
