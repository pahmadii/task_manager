import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBio1758698933746 implements MigrationInterface {
  name = 'AddUserBio1758698933746';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "bio" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "bio"`);
  }
}
