#!/usr/bin/env bash

export CODE_TESTS_PATH="$(pwd)/dist/client/test"
export CODE_TESTS_WORKSPACE="$(pwd)/client/testFixture"

node "$(pwd)/dist/client/test/runTest"
