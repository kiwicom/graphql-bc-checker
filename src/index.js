// @flow

import os from 'os';
import {
  findBreakingChanges,
  findDangerousChanges,
  buildSchema,
  printSchema,
  lexicographicSortSchema,
  type GraphQLSchema,
} from 'graphql';
import fs from 'fs';

import SignedSource from './SignedSource';
import { buildBreakingChangesBlock } from './BCLogger';
import {
  printBreakingChanges,
  printDangerousChanges,
  note,
  success,
  warning,
  error,
} from './Printer';

const terminate = (cb?: () => void = () => {}) => {
  cb();
  process.exit(1);
};

const createSnapshot = (breakingChangesBlock, newSchema) => {
  return SignedSource.signFile(
    `# ${SignedSource.getSigningToken()}` +
      os.EOL +
      os.EOL +
      breakingChangesBlock +
      os.EOL +
      os.EOL +
      printSchema(lexicographicSortSchema(newSchema)),
  );
};

type Options = {|
  +allowBreakingChanges: boolean,
  +snapshotLocation: string,
  +schema: GraphQLSchema,
|};

export default function testBackwardCompatibility({
  allowBreakingChanges,
  snapshotLocation,
  schema,
}: Options): void {
  const newSchema = schema;
  try {
    fs.accessSync(snapshotLocation, fs.constants.F_OK);
    // snapshot is readable

    const oldSnapshot = fs.readFileSync(snapshotLocation).toString();
    const oldSchema = buildSchema(oldSnapshot);

    if (!SignedSource.verifySignature(oldSnapshot)) {
      terminate(
        error(
          'Manual changes of GraphQL snapshot detected. Please do not update GraphQL snapshot manually. This file is being autogenerated.',
        ),
      );
    }

    const breakingChanges = findBreakingChanges(oldSchema, newSchema);
    if (breakingChanges.length > 0) {
      printBreakingChanges(breakingChanges);
      if (allowBreakingChanges === false) {
        terminate();
      }
    }

    const dangerousChanges = findDangerousChanges(oldSchema, newSchema);
    if (dangerousChanges.length > 0) {
      printDangerousChanges(dangerousChanges);
    }

    const breakingChangesBlock = buildBreakingChangesBlock(
      oldSnapshot,
      breakingChanges,
    );
    const newSnapshot = createSnapshot(breakingChangesBlock, newSchema);

    if (newSnapshot !== oldSnapshot) {
      warning('GraphQL schema snapshot IS OUTDATED! (updating automatically)');
      fs.writeFileSync(snapshotLocation, newSnapshot);

      // this is also considered failure so CI will fail (must be committed manually)
      terminate(
        note(
          'Snapshot of the GraphQL schema successfully created! In case you see this message in CI you have to run locally command `yarn test-bc` and commit the changes.',
        ),
      );
    } else {
      success(
        'Congratulations! NO BREAKING CHANGES or OUTDATED SCHEMA. Good job!',
      );
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      // first run, snapshot doesn't exist yet (we have to just snapshot the schema)
      error(err);

      const breakingChangesBlock = buildBreakingChangesBlock('');
      const newSnapshot = createSnapshot(breakingChangesBlock, newSchema);

      fs.writeFileSync(snapshotLocation, newSnapshot);

      success(`New GraphQL snapshot saved to: ${snapshotLocation}`);
    }

    throw err;
  }
}