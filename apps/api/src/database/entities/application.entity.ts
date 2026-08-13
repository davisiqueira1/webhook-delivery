import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Endpoint } from './endpoint.entity';
import { Message } from './message.entity';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
  })
  createdAt: Date;

  @OneToMany(() => Endpoint, (e) => e.application)
  endpoints: Endpoint[];

  @OneToMany(() => Message, (m) => m.application)
  messages: Message[];
}
