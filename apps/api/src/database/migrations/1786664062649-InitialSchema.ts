import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1786664062649 implements MigrationInterface {
    name = 'InitialSchema1786664062649'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "event_type" text NOT NULL, "payload" jsonb NOT NULL, "idempotency_key" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_310dff53aa2b45d94ba4399adad" UNIQUE ("application_id", "idempotency_key"), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "delivery_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "delivery_id" uuid NOT NULL, "attempt_number" integer NOT NULL, "status_code" integer, "error" text, "duration_ms" integer NOT NULL, "attempted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_41eba4eb5401d72860f7cd9a7ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a9d7e7212c87084249a641ab45" ON "delivery_attempts"  ("delivery_id") `);
        await queryRunner.query(`CREATE TABLE "deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "message_id" uuid NOT NULL, "endpoint_id" uuid NOT NULL, "status" text NOT NULL, "attempt_count" integer NOT NULL DEFAULT '0', "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_0bd139c8ab46876c37cc20f9ae6" UNIQUE ("message_id", "endpoint_id"), CONSTRAINT "PK_a6ef225c5c5f0974e503bfb731f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "endpoints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "url" text NOT NULL, "secret" text NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_70835610dfa54ad5d990e02f70a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c77357c13fe8466408a837722e" ON "endpoints"  ("application_id") `);
        await queryRunner.query(`CREATE TABLE "applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_938c0a27255637bde919591888f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_5d3ec1cb962de6488637fd779d6" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_attempts" ADD CONSTRAINT "FK_a9d7e7212c87084249a641ab455" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deliveries" ADD CONSTRAINT "FK_19ad1003a453736973ea6c728e7" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deliveries" ADD CONSTRAINT "FK_545cafb438b60f8304ef4dd6508" FOREIGN KEY ("endpoint_id") REFERENCES "endpoints"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "endpoints" ADD CONSTRAINT "FK_c77357c13fe8466408a837722eb" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "endpoints" DROP CONSTRAINT "FK_c77357c13fe8466408a837722eb"`);
        await queryRunner.query(`ALTER TABLE "deliveries" DROP CONSTRAINT "FK_545cafb438b60f8304ef4dd6508"`);
        await queryRunner.query(`ALTER TABLE "deliveries" DROP CONSTRAINT "FK_19ad1003a453736973ea6c728e7"`);
        await queryRunner.query(`ALTER TABLE "delivery_attempts" DROP CONSTRAINT "FK_a9d7e7212c87084249a641ab455"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_5d3ec1cb962de6488637fd779d6"`);
        await queryRunner.query(`DROP TABLE "applications"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c77357c13fe8466408a837722e"`);
        await queryRunner.query(`DROP TABLE "endpoints"`);
        await queryRunner.query(`DROP TABLE "deliveries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a9d7e7212c87084249a641ab45"`);
        await queryRunner.query(`DROP TABLE "delivery_attempts"`);
        await queryRunner.query(`DROP TABLE "messages"`);
    }

}
