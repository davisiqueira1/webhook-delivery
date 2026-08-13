import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Application } from './application.entity';
import { Delivery } from './delivery.entity';

@Entity('endpoints')
export class Endpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Application, { nullable: false })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @Index()
  @Column('uuid', { name: 'application_id', nullable: false })
  applicationId: string;

  @Column('text')
  url: string;

  @Column('text')
  secret: string;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
  })
  createdAt: Date;

  @OneToMany(() => Delivery, (d) => d.endpointId)
  delivery: Delivery[];
}
