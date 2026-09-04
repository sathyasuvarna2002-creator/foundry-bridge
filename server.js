require("dotenv").config();

const express = require("express");
const { exec, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());


// =====================================================
// CONFIG -- all overridable via environment variables (see .env.example).
// Defaults below match this machine's original setup, so this file keeps
// working unchanged here -- anyone else running FoundryBridge should
// copy .env.example to .env and fill in their own paths instead of
// editing this file.
// =====================================================

const PORT =
  process.env.PORT ||
  3000;


// =====================================================
// FOUNDRY CONFIG
// =====================================================

const FOUNDRY_PATH =
  process.env.FOUNDRY_PATH ||
  String.raw`C:\Users\Sathya\Desktop\FoundryValidation`;

const OUTPUT_FILE =
  path.join(
    FOUNDRY_PATH,
    "output",
    "validation.json"
  );

const FORGE_EXE =
  process.env.FORGE_EXE ||
  String.raw`C:\Users\Sathya\.foundry\bin\forge.exe`;

const CAST_EXE =
  process.env.CAST_EXE ||
  String.raw`C:\Users\Sathya\.foundry\bin\cast.exe`;


// =====================================================
// SLITHER CONFIG
// =====================================================

const SLITHER_PATH =
  process.env.SLITHER_PATH ||
  String.raw`C:\Users\Sathya\AppData\Local\Python\pythoncore-3.14-64\Scripts\slither.exe`;

const PYTHON_SCRIPTS =
  process.env.PYTHON_SCRIPTS ||
  String.raw`C:\Users\Sathya\AppData\Local\Python\pythoncore-3.14-64\Scripts`;

const SLITHER_OUTPUT =
  process.env.SLITHER_OUTPUT ||
  String.raw`C:\Temp\slither-output.json`;


// =====================================================
// HELPERS
// =====================================================

function cleanRpcUrl(value) {

  if (!value) {
    return "";
  }

  let url = String(value).trim();

  /*
   * Protect against accidentally passing markdown-style
   * URL formatting from an n8n field.
   *
   * Expected:
   * https://eth-mainnet.g.alchemy.com/v2/...
   *
   * Not:
   * [https://eth-mainnet.g.alchemy.com/v2/...](...)
   */

  if (url.startsWith("[") && url.includes("](")) {

    const match =
      url.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (match) {
      url = match[2];
    }
  }

  return url;
}


function cleanAddress(value) {

  if (!value) {
    return null;
  }

  const address =
    String(value)
      .trim()
      .toLowerCase();

  if (
    !/^0x[a-f0-9]{40}$/.test(address)
  ) {
    return null;
  }

  return address;
}


function addressesEqual(a, b) {

  const aa =
    cleanAddress(a);

  const bb =
    cleanAddress(b);

  return (
    aa !== null &&
    bb !== null &&
    aa === bb
  );
}


// =====================================================
// CAST CALL
// =====================================================
//
// Uses the EXISTING Foundry installation.
//
// We deliberately use cast call rather than fetch/ethers
// inside Node.js.
//
// This gives us an actual eth_call against the supplied RPC.
//
// =====================================================

function castCall(
  target,
  signature,
  rpcUrl,
  callArgs = []
) {

  return new Promise((resolve) => {

    const args = [
      "call",
      target,
      signature,
      ...callArgs,
      "--rpc-url",
      rpcUrl
    ];

    console.log("\nRunning cast call:");
    console.log(
      `${CAST_EXE} ${args.join(" ")}`
    );

    execFile(
      CAST_EXE,
      args,
      {
        windowsHide: true,
        timeout: 30000
      },
      (error, stdout, stderr) => {

        if (error) {

          console.error(
            `cast call failed: ${signature}`
          );

          console.error(
            stderr || error.message
          );

          return resolve({

            executed: false,

            error:
              stderr ||
              error.message,

            function:
              signature
          });
        }


        const returned =
          String(stdout || "")
            .trim();


        console.log(
          `Returned from ${signature}:`,
          returned
        );


        resolve({

          executed: true,

          function:
            signature,

          returned
        });
      }
    );
  });
}


// =====================================================
// ADDRESS RESOLVER CHECK
// =====================================================

async function runAddressResolverCheck({
  checkId,
  resolverAddress,
  functionSignature,
  expectedAddress
}) {

  const expected =
    cleanAddress(expectedAddress);

  if (!resolverAddress) {

    return {

      checkId,

      function:
        functionSignature,

      executed:
        false,

      passed:
        false,

      returned:
        null,

      expected:
        expected,

      matched:
        false,

      status:
        "NOT_TESTED",

      reason:
        "Resolver contract address was unavailable."
    };
  }


  if (!expected) {

    return {

      checkId,

      function:
        functionSignature,

      executed:
        false,

      passed:
        false,

      returned:
        null,

      expected:
        null,

      matched:
        false,

      status:
        "NOT_TESTED",

      reason:
        "Independent expected address was unavailable."
    };
  }


  const result =
    await castCall(
      resolverAddress,
      functionSignature,
      CURRENT_RPC_URL
    );


  if (!result.executed) {

    return {

      checkId,

      function:
        functionSignature,

      executed:
        false,

      passed:
        false,

      returned:
        null,

      expected,

      matched:
        false,

      status:
        "NOT_TESTED",

      reason:
        result.error ||
        "Resolver call failed."
    };
  }


  /*
   * cast normally returns an address directly for
   * address-returning functions.
   */

  const returned =
    cleanAddress(
      result.returned
    );


  if (!returned) {

    return {

      checkId,

      function:
        functionSignature,

      executed:
        true,

      passed:
        false,

      returned:
        result.returned,

      expected,

      matched:
        false,

      status:
        "FAIL",

      reason:
        "Resolver executed but did not return a valid address."
    };
  }


  const matched =
    addressesEqual(
      returned,
      expected
    );


  return {

    checkId,

    function:
      functionSignature,

    executed:
      true,

    passed:
      matched,

    returned,

    expected,

    matched,

    status:
      matched
        ? "PASS"
        : "FAIL",

    reason:
      matched
        ? "Resolver returned the independently observed expected address."
        : "Resolver returned an address different from the independently observed expected address."
  };
}


// =====================================================
// ADDRESS EXISTENCE CHECK
// =====================================================
//
// Unlike runAddressResolverCheck (which cross-checks against a
// SECOND, independently-discovered address), this only confirms
// that a resolver call returns a real, non-zero address. Used for
// components where we don't have a second independent source to
// compare against -- currently just Umbrella (F05-P01).
// =====================================================

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

async function runAddressExistenceCheck({
  checkId,
  resolverAddress,
  functionSignature,
  callArgs = []
}) {

  if (!resolverAddress) {

    return {

      checkId,

      function:
        functionSignature,

      executed:
        false,

      passed:
        false,

      returned:
        null,

      expected:
        "non-zero address",

      matched:
        false,

      status:
        "NOT_TESTED",

      reason:
        "Resolver contract address was unavailable."
    };
  }


  const result =
    await castCall(
      resolverAddress,
      functionSignature,
      CURRENT_RPC_URL,
      callArgs
    );


  if (!result.executed) {

    return {

      checkId,

      function:
        functionSignature,

      executed:
        false,

      passed:
        false,

      returned:
        null,

      expected:
        "non-zero address",

      matched:
        false,

      status:
        "NOT_TESTED",

      reason:
        result.error ||
        "Resolver call failed."
    };
  }


  const returned =
    cleanAddress(
      result.returned
    );

  const exists =
    returned !== null &&
    returned !== ZERO_ADDRESS;


  return {

    checkId,

    function:
      functionSignature,

    executed:
      true,

    passed:
      exists,

    returned:
      result.returned,

    expected:
      "non-zero address",

    matched:
      exists,

    status:
      exists
        ? "PASS"
        : "FAIL",

    reason:
      exists
        ? "Resolver returned a non-zero address, confirming this component is configured."
        : "Resolver returned the zero address (or an invalid value) -- this component does not appear to be configured, OR the lookup ID used does not match what this deployment actually uses."
  };
}


// =====================================================
// MARKET LISTED CHECK (Venus / Compound-fork specific)
// =====================================================
//
// Comptroller.markets(vToken) returns a (bool isListed, uint256
// collateralFactorMantissa) tuple, not a single address -- neither
// of the two check helpers above fits, so this is a third, narrower
// helper for that specific shape.
//
// This is NOT the same on-chain fact re-read twice. It queries a
// DIFFERENT contract (the Comptroller, not the vToken) about a
// DIFFERENT relationship (does the Comptroller list this specific
// vToken as a market) than what VenusValidator.sol already reads
// during the forge pass (which only reads vToken.comptroller() --
// the vToken's own claim about who governs it -- and
// comptroller.getAllMarkets().length, a count, not membership).
// Agreement between "vToken says Comptroller X governs it" and
// "Comptroller X says this vToken is a listed market" is genuine
// two-source corroboration, not a getter checked against itself.
// =====================================================

async function runMarketListedCheck({
  checkId,
  comptrollerAddress,
  vTokenAddress
}) {

  if (!comptrollerAddress || !vTokenAddress) {

    return {

      checkId,

      function:
        "markets(address)(bool,uint256)",

      executed:
        false,

      passed:
        false,

      returned:
        null,

      expected:
        "isListed == true",

      matched:
        false,

      status:
        "NOT_TESTED",

      reason:
        "Comptroller address or vToken address was unavailable."
    };
  }


  const result =
    await castCall(
      comptrollerAddress,
      "markets(address)(bool,uint256)",
      CURRENT_RPC_URL,
      [vTokenAddress]
    );


  if (!result.executed) {

    return {

      checkId,

      function:
        "markets(address)(bool,uint256)",

      executed:
        false,

      passed:
        false,

      returned:
        null,

      expected:
        "isListed == true",

      matched:
        false,

      status:
        "NOT_TESTED",

      reason:
        result.error ||
        "Comptroller call failed."
    };
  }


  /*
   * cast prints tuple values whitespace-separated in declaration
   * order -- isListed (bool) comes first.
   */

  const raw =
    String(result.returned || "")
      .trim();

  const isListed =
    /^true/i.test(raw);


  return {

    checkId,

    function:
      "markets(address)(bool,uint256)",

    executed:
      true,

    passed:
      isListed,

    returned:
      raw,

    expected:
      "isListed == true",

    matched:
      isListed,

    status:
      isListed
        ? "PASS"
        : "FAIL",

    reason:
      isListed
        ? "Comptroller confirms this vToken is a listed market."
        : "Comptroller does NOT list this vToken as a market -- either the comptroller() address the vToken reports is stale/wrong, or this vToken is not (or no longer) an active market on that comptroller."
  };
}


// =====================================================
// RESOLVER VALIDATION
// =====================================================

let CURRENT_RPC_URL = "";


async function runResolverValidation(
  validation
) {

  /*
   * These values come from the EXISTING Foundry output.
   *
   * We do not generate expected values here.
   */

  const addressProvider =
    validation.addressProvider;

  const pool =
    validation.comptroller &&
    validation.protocolName === "Aave"
      ? validation.contractAddress ||
        null
      : validation.contractAddress ||
        null;


  const observedPool =
    validation.pool ||
    validation.contractAddress ||
    null;

  const aclManager =
    validation.aclManager;

  const poolConfigurator =
    validation.poolConfigurator;

  const oracle =
    validation.oracle;


  const checks = [];


  // ---------------------------------------------------
  // F01 / PoolAddressesProvider → Pool
  // ---------------------------------------------------

  if (
    validation.protocolName === "Aave" &&
    addressProvider &&
    observedPool
  ) {

    checks.push(
      await runAddressResolverCheck({

        checkId:
          "F01-P03-POOL",

        resolverAddress:
          addressProvider,

        functionSignature:
          "getPool()(address)",

        expectedAddress:
          observedPool
      })
    );
  }


  // ---------------------------------------------------
  // F04 / PoolAddressesProvider → PoolConfigurator
  // ---------------------------------------------------

  if (
    validation.protocolName === "Aave" &&
    addressProvider &&
    poolConfigurator
  ) {

    checks.push(
      await runAddressResolverCheck({

        checkId:
          "F04-P02",

        resolverAddress:
          addressProvider,

        functionSignature:
          "getPoolConfigurator()(address)",

        expectedAddress:
          poolConfigurator
      })
    );
  }


  // ---------------------------------------------------
  // F06 / PoolAddressesProvider → Oracle
  // ---------------------------------------------------

  if (
    validation.protocolName === "Aave" &&
    addressProvider &&
    oracle
  ) {

    checks.push(
      await runAddressResolverCheck({

        checkId:
          "F06-P02",

        resolverAddress:
          addressProvider,

        functionSignature:
          "getPriceOracle()(address)",

        expectedAddress:
          oracle
      })
    );
  }


  // ---------------------------------------------------
  // F03 / PoolAddressesProvider → ACL Manager
  // ---------------------------------------------------

  if (
    validation.protocolName === "Aave" &&
    addressProvider &&
    aclManager
  ) {

    checks.push(
      await runAddressResolverCheck({

        checkId:
          "F03-P02",

        resolverAddress:
          addressProvider,

        functionSignature:
          "getACLManager()(address)",

        expectedAddress:
          aclManager
      })
    );
  }


  // ---------------------------------------------------
  // F05 / PoolAddressesProvider → Umbrella
  // ---------------------------------------------------
  //
  // No dedicated getter like getPool()/getPriceOracle() exists for
  // Umbrella -- it's read via the generic getAddress(bytes32) lookup.
  // UMBRELLA_ID below is keccak256("UMBRELLA"), following the same
  // hashing convention Aave uses internally for POOL, ACL_MANAGER,
  // PRICE_ORACLE etc. We don't have a second independent source to
  // cross-check against here (unlike the 4 checks above), so this
  // only confirms existence, not agreement between two sources.
  // ---------------------------------------------------

  const UMBRELLA_ID =
    "0x584af22c9a33182c109099e5c90d710710600d8e10e3b2cb64ce23b3dbda3c94";

  if (
    validation.protocolName === "Aave" &&
    addressProvider
  ) {

    checks.push(
      await runAddressExistenceCheck({

        checkId:
          "F05-P01-UMBRELLA",

        resolverAddress:
          addressProvider,

        functionSignature:
          "getAddress(bytes32)(address)",

        callArgs:
          [UMBRELLA_ID]
      })
    );
  }


  // ---------------------------------------------------
  // VENUS-P01 / vToken -> Comptroller market listing
  // ---------------------------------------------------
  //
  // See runMarketListedCheck() above for why this is a genuine
  // two-source cross-check, not a getter re-read against itself.
  // validation.comptroller and validation.contractAddress both come
  // from the Foundry ValidateProtocol run (VenusValidator.sol reading
  // vToken.comptroller(), and the vToken address the caller supplied
  // to /validate respectively) -- this check adds a THIRD, fresh
  // on-chain read (comptroller.markets(vToken)) that the forge pass
  // does not currently perform.
  // ---------------------------------------------------

  if (
    validation.protocolName === "Venus Protocol" &&
    validation.comptroller &&
    validation.contractAddress
  ) {

    checks.push(
      await runMarketListedCheck({

        checkId:
          "VENUS-P01-COMPTROLLER-LISTING",

        comptrollerAddress:
          validation.comptroller,

        vTokenAddress:
          validation.contractAddress
      })
    );
  }


  // ---------------------------------------------------
  // VENUS-P02 / vToken -> underlying asset cross-check
  // ---------------------------------------------------
  //
  // Only executes a real comparison if validation.expectedUnderlying
  // is supplied from an INDEPENDENT source (e.g. Node06 architecture
  // evidence citing a known deployment/registry address for the
  // underlying token) -- deliberately NOT sourced from this same
  // forge run's own underlying() read, which would make this a
  // same-getter-twice check like the F03/F04/F06 caveat noted in
  // Venus_ClaimID_Taxonomy_and_DryRun.md / the open circularity
  // question (task #15). Until that independent value is wired in
  // from upstream, this legitimately reports NOT_TESTED rather than
  // silently passing or being skipped -- its absence stays visible.
  // ---------------------------------------------------

  if (
    validation.protocolName === "Venus Protocol" &&
    validation.contractAddress
  ) {

    checks.push(
      await runAddressResolverCheck({

        checkId:
          "VENUS-P02-UNDERLYING",

        resolverAddress:
          validation.contractAddress,

        functionSignature:
          "underlying()(address)",

        expectedAddress:
          validation.expectedUnderlying ||
          null
      })
    );
  }


  // ---------------------------------------------------
  // COMPOUND-P01 / cToken -> Comptroller market listing
  // ---------------------------------------------------
  //
  // Same two-source cross-check as VENUS-P01 above -- Compound V2's
  // Comptroller uses the same markets(address) => (bool isListed, ...)
  // pattern Venus forked (Venus is itself a Compound V2 fork), so
  // runMarketListedCheck() is directly reusable, no protocol-specific
  // parsing needed. Previously missing entirely: no protocolName ===
  // "Compound" branch existed anywhere in this function, which is why
  // resolver_validation stayed { executed: false, checksPerformed: 0 }
  // on every Compound /validate call regardless of how many
  // CompoundValidator.sol checks actually succeeded -- same class of
  // gap already found and fixed on CompoundValidator.sol itself.
  // ---------------------------------------------------

  if (
    validation.protocolName === "Compound" &&
    validation.comptroller &&
    validation.contractAddress
  ) {

    checks.push(
      await runMarketListedCheck({

        checkId:
          "COMPOUND-P01-COMPTROLLER-LISTING",

        comptrollerAddress:
          validation.comptroller,

        vTokenAddress:
          validation.contractAddress
      })
    );
  }


  // ---------------------------------------------------
  // COMPOUND-P02 / cToken -> underlying asset cross-check
  // ---------------------------------------------------
  //
  // Same acknowledged, honest gap as VENUS-P02 above: only executes a
  // real comparison if validation.expectedUnderlying is supplied from
  // an INDEPENDENT source (e.g. Node06 architecture evidence), not
  // from this same forge run's own underlying() read. Until that's
  // wired in from upstream, this legitimately reports NOT_TESTED
  // rather than silently passing or being skipped.
  // ---------------------------------------------------

  if (
    validation.protocolName === "Compound" &&
    validation.contractAddress
  ) {

    checks.push(
      await runAddressResolverCheck({

        checkId:
          "COMPOUND-P02-UNDERLYING",

        resolverAddress:
          validation.contractAddress,

        functionSignature:
          "underlying()(address)",

        expectedAddress:
          validation.expectedUnderlying ||
          null
      })
    );
  }


  // ---------------------------------------------------
  // Summary
  // ---------------------------------------------------

  const passed =
    checks.filter(
      c =>
        c.status === "PASS"
    ).length;

  const failed =
    checks.filter(
      c =>
        c.status === "FAIL"
    ).length;

  const notTested =
    checks.filter(
      c =>
        c.status === "NOT_TESTED"
    ).length;


  return {

    executed:
      checks.some(
        c =>
          c.executed === true
      ),

    checksPerformed:
      checks.length,

    checksPassed:
      passed,

    checksFailed:
      failed,

    checksNotTested:
      notTested,

    allChecksPassed:
      checks.length > 0 &&
      passed === checks.length,

    checks
  };
}


// =====================================================
// FOUNDRY VALIDATION
// =====================================================

app.post("/validate", (req, res) => {

  const {

    protocol,

    contract_address,

    rpc_url

  } = req.body;


  if (
    !protocol ||
    !contract_address ||
    !rpc_url
  ) {

    return res.status(400).json({

      success:
        false,

      error:
        "protocol, contract_address and rpc_url are required."

    });
  }


  const cleanContractAddress =
    cleanAddress(
      contract_address
    );

  const cleanRPC =
    cleanRpcUrl(
      rpc_url
    );


  if (!cleanContractAddress) {

    return res.status(400).json({

      success:
        false,

      error:
        "Invalid contract address."
    });
  }


  if (!cleanRPC) {

    return res.status(400).json({

      success:
        false,

      error:
        "Invalid RPC URL."
    });
  }


  CURRENT_RPC_URL =
    cleanRPC;


  /*
   * Use execFile instead of constructing a shell command.
   *
   * This avoids shell interpretation of the supplied RPC URL
   * and contract address.
   */

  const forgeArgs = [

    "script",

    "script/ValidateProtocol.s.sol:ValidateProtocol",

    "--sig",

    "run(string,address,string)",

    protocol,

    cleanContractAddress,

    cleanRPC
  ];


  console.log(
    "\n======================================"
  );

  console.log(
    "Running Foundry validation"
  );

  console.log(
    "======================================"
  );


  execFile(

    FORGE_EXE,

    forgeArgs,

    {
      cwd:
        FOUNDRY_PATH,

      windowsHide:
        true,

      timeout:
        120000
    },

    async (error, stdout, stderr) => {

      if (error) {

        console.error(
          "Forge error:"
        );

        console.error(
          stderr ||
          error.message
        );

        return res.status(500).json({

          success:
            false,

          error:
            stderr ||
            error.message
        });
      }


      if (!fs.existsSync(
        OUTPUT_FILE
      )) {

        return res.status(500).json({

          success:
            false,

          error:
            "validation.json not found"
        });
      }


      try {

        const result =
          JSON.parse(
            fs.readFileSync(
              OUTPUT_FILE,
              "utf8"
            )
          );


        /*
         * Existing result remains untouched.
         *
         * We only add resolver_validation.
         */

        result.contractAddress =
          cleanContractAddress;


        /*
         * Run the independent resolver calls.
         */

        const resolverValidation =
          await runResolverValidation(
            result
          );


        /*
         * Add resolver evidence.
         */

        result.resolver_validation =
          resolverValidation;


        /*
         * Also expose the structure Node 16
         * expects.
         */

        result.resolver_execution_results =
          {};


        for (
          const check
          of resolverValidation.checks
        ) {

          result.resolver_execution_results[
            check.checkId
          ] = {

            executed:
              check.executed,

            result:
              check.status,

            returned_value:
              check.returned,

            expected_value:
              check.expected,

            value_matches:
              check.matched,

            function_name:
              check.function
          };
        }


        return res.json(
          result
        );

      }

      catch (err) {

        console.error(
          "Validation processing error:",
          err
        );

        return res.status(500).json({

          success:
            false,

          error:
            err.message
        });
      }
    }
  );

});


// =====================================================
// VENUS DONATION-ATTACK BEHAVIOURAL TEST
// =====================================================
//
// Runs the stateful VenusDonationAttack.t.sol Foundry test (fork +
// impersonation + real transfer, NOT a view call -- see
// Venus_StateBehavior_Check_Design.md) and returns a result shaped to
// drop directly into Node 14's assessExperiment()/findExperiment()
// pathway, which already looks for:
//
//   foundry.behavioral_validation[proposition_id] = { passed: true/false, ... }
//
// PROPOSITION_ID below must match whatever proposition_id is used on
// the corresponding predicate added to Node 13's SPEC table.
//
// Applies the SUPPORTED / CONTRADICTED / UNRESOLVED verdict table from
// Venus_StateBehavior_Check_Design.md:
//   core PASS + control PASS  -> SUPPORTED
//   core FAIL + control PASS  -> CONTRADICTED
//   core FAIL + control FAIL  -> UNRESOLVED (fork/instrumentation problem)
//   core PASS + control FAIL  -> UNRESOLVED (flag for manual review)

const DONATION_ATTACK_PROPOSITION_ID =
  "VENUS-DONATION-01";

const DONATION_ATTACK_CORE_TEST =
  "test_DonationMovesExchangeRateWithoutMint";

const DONATION_ATTACK_CONTROL_TEST =
  "test_Control_MintAlsoMovesCash";


function extractForgeTestJson(stdout) {

  const firstBrace =
    stdout.indexOf("{");

  if (firstBrace === -1) {
    throw new Error(
      "No JSON object found in forge test output."
    );
  }

  return JSON.parse(
    stdout.slice(firstBrace)
  );
}


function findTestResult(parsed, testNameSubstring) {

  for (

    const suiteKey
    of Object.keys(parsed)

  ) {

    const suite =
      parsed[suiteKey];

    const testResults =
      suite?.test_results;

    if (!testResults) {
      continue;
    }

    for (

      const testKey
      of Object.keys(testResults)

    ) {

      if (
        testKey.includes(
          testNameSubstring
        )
      ) {

        return testResults[testKey];
      }
    }
  }

  return null;
}


function normaliseForgeStatus(result) {

  if (!result) {
    return null;
  }

  const status =
    String(
      result.status ||
      ""
    ).toLowerCase();

  if (
    status.includes("success") ||
    status.includes("pass")
  ) {
    return "pass";
  }

  if (
    status.includes("fail")
  ) {
    return "fail";
  }

  return null;
}


app.post("/validate-donation-attack", (req, res) => {

  const {
    rpc_url
  } = req.body || {};

  const cleanRPC =
    cleanRpcUrl(
      rpc_url
    ) ||
    CURRENT_RPC_URL;

  if (!cleanRPC) {

    return res.status(400).json({

      success:
        false,

      error:
        "rpc_url is required (or must have already been set by a prior /validate call)."
    });
  }


  const forgeArgs = [

    "test",

    "--match-contract",

    "VenusDonationAttackTest",

    "--json"
  ];


  console.log(
    "\n======================================"
  );

  console.log(
    "Running Venus donation-attack behavioural test"
  );

  console.log(
    "======================================"
  );


  execFile(

    FORGE_EXE,

    forgeArgs,

    {
      cwd:
        FOUNDRY_PATH,

      windowsHide:
        true,

      timeout:
        120000,

      env: {
        ...process.env,

        BSC_RPC_URL:
          cleanRPC
      },

      maxBuffer:
        1024 * 1024 * 20
    },

    (error, stdout, stderr) => {

      // forge exits non-zero when a test fails -- that is NOT
      // itself a server error, it's a real, expected CONTRADICTED/
      // UNRESOLVED outcome. Only treat it as a hard error if we
      // also can't parse any JSON out of stdout at all.

      let parsed;

      try {

        parsed =
          extractForgeTestJson(
            stdout ||
            ""
          );

      } catch (parseError) {

        return res.status(500).json({

          success:
            false,

          error:
            "Could not parse forge test --json output.",

          parse_error:
            parseError.message,

          stdout,

          stderr
        });
      }


      const coreResult =
        findTestResult(
          parsed,
          DONATION_ATTACK_CORE_TEST
        );

      const controlResult =
        findTestResult(
          parsed,
          DONATION_ATTACK_CONTROL_TEST
        );

      const coreStatus =
        normaliseForgeStatus(
          coreResult
        );

      const controlStatus =
        normaliseForgeStatus(
          controlResult
        );


      let verdict;
      let verdictReason;

      if (coreStatus === "pass" && controlStatus === "pass") {

        verdict = "SUPPORTED";
        verdictReason =
          "Core test passed (donation moved exchange rate without mint) and control test passed (instrumentation confirmed sound via the normal gated mint path).";

      } else if (coreStatus === "fail" && controlStatus === "pass") {

        verdict = "CONTRADICTED";
        verdictReason =
          "Core test failed while control test passed -- instrumentation is sound, so the architectural claim genuinely did not hold at this block.";

      } else if (coreStatus === "fail" && controlStatus === "fail") {

        verdict = "UNRESOLVED";
        verdictReason =
          "Both core and control tests failed -- likely a fork/instrumentation problem (wrong block, RPC issue, insufficient balance), not evidence about the architecture. Do not report as CONTRADICTED.";

      } else if (coreStatus === "pass" && controlStatus === "fail") {

        verdict = "UNRESOLVED";
        verdictReason =
          "Core test passed but control test failed -- unusual combination, flagged for manual review rather than auto-classified. Check the control's failure reason (e.g. an unrelated policy rejection like a supply cap) before drawing conclusions.";

      } else {

        verdict = "UNRESOLVED";
        verdictReason =
          "Could not determine pass/fail status for one or both tests from forge's output.";
      }


      const passed =
        verdict === "SUPPORTED";


      return res.json({

        success:
          true,

        proposition_id:
          DONATION_ATTACK_PROPOSITION_ID,

        claim_id:
          "VENUS-BALANCEOF-EXCHANGERATESTOREDINTERNAL-GETCASHPRIOR",

        anchor_tokens: [
          "getCashPrior",
          "exchangeRateStoredInternal",
          "balanceOf",
          "doTransferIn",
          "underlying"
        ],

        core_test: {
          name: DONATION_ATTACK_CORE_TEST,
          status: coreStatus,
          raw: coreResult
        },

        control_test: {
          name: DONATION_ATTACK_CONTROL_TEST,
          status: controlStatus,
          raw: controlResult
        },

        verdict,

        verdict_reason:
          verdictReason,

        // Shaped for Node 14's findExperiment()/assessExperiment(),
        // which looks in foundry.behavioral_validation[proposition_id]
        // for { passed: true/false }.
        behavioral_validation: {
          [DONATION_ATTACK_PROPOSITION_ID]: {
            passed,
            status:
              verdict,
            reason:
              verdictReason
          }
        },

        forge_exit_error:
          error ?
            (error.message || String(error)) :
            null
      });
    }
  );

});


// =====================================================
// SLITHER ANALYSIS
// =====================================================

app.post("/slither", (req, res) => {

  if (
    fs.existsSync(
      SLITHER_OUTPUT
    )
  ) {

    try {

      fs.unlinkSync(
        SLITHER_OUTPUT
      );

      console.log(
        "Deleted previous Slither report."
      );

    }

    catch (err) {

      console.error(
        "Unable to delete old report:",
        err
      );
    }
  }


  const filePath =
    req.body.filePath;


  if (!filePath) {

    return res.status(400).json({

      success:
        false,

      error:
        "filePath is required."
    });
  }


  const fileName =
    path.basename(
      filePath
    );

  const workingDir =
    path.dirname(
      filePath
    );


  const command =
    `cd /d "${workingDir}" && "${SLITHER_PATH}" "${fileName}" --json "${SLITHER_OUTPUT}"`;


  console.log(
    "\nRunning Slither..."
  );

  console.log(
    command
  );


  exec(

    command,

    {

      env: {

        ...process.env,

        PATH:
          process.env.PATH +
          ";" +
          PYTHON_SCRIPTS

      }

    },

    (error, stdout, stderr) => {

      console.log(
        stdout
      );


      if (stderr) {

        console.error(
          stderr
        );
      }


      if (
        fs.existsSync(
          SLITHER_OUTPUT
        )
      ) {

        try {

          const results =
            JSON.parse(

              fs.readFileSync(
                SLITHER_OUTPUT,
                "utf8"
              )

            );


          return res.json({

            success:
              true,

            slither:
              results

          });

        }

        catch (err) {

          return res.status(500).json({

            success:
              false,

            error:
              "Failed to parse Slither JSON: " +
              err.message

          });
        }
      }


      return res.status(500).json({

        success:
          false,

        error:
          stderr ||
          stdout ||
          error?.message ||
          "Slither failed."

      });

    }
  );

});


// =====================================================
// SERVER
// =====================================================

app.listen(

  PORT,

  () => {

    console.log(
      `Foundry Bridge running on http://localhost:${PORT}`
    );

    console.log(
      `Foundry validation: POST http://localhost:${PORT}/validate`
    );

    console.log(
      `Slither analysis: POST http://localhost:${PORT}/slither`
    );

    console.log(
      `Venus donation-attack test: POST http://localhost:${PORT}/validate-donation-attack`
    );

  }

);
