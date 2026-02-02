/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/orbit_finance.json`.
 */
export type OrbitFinance = {
  "address": "Fn3fA3fjsmpULNL7E9U79jKTe1KHxPtQeWdURCbJXCnM",
  "metadata": {
    "name": "orbitFinance",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "addLiquidityV2",
      "docs": [
        "Adds liquidity to multiple bins using BinArray architecture.",
        "",
        "# V2 Features",
        "- Snapshots fee growth before deposit (prevents front-running)",
        "- Validates vault balance increases match expected amounts",
        "- Post-deposit accounting validation",
        "- Auto-compounding fee tracking initialized",
        "",
        "# Usage",
        "Can deposit into bins across multiple BinArrays in a single transaction."
      ],
      "discriminator": [
        126,
        118,
        210,
        37,
        80,
        190,
        19,
        105
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "Pool (zero-copy)."
          ],
          "writable": true
        },
        {
          "name": "owner",
          "docs": [
            "Position owner (signs)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "ownerBase",
          "docs": [
            "Owner's base token account."
          ],
          "writable": true
        },
        {
          "name": "ownerQuote",
          "docs": [
            "Owner's quote token account."
          ],
          "writable": true
        },
        {
          "name": "baseVault",
          "docs": [
            "Pool's base vault."
          ],
          "writable": true
        },
        {
          "name": "quoteVault",
          "docs": [
            "Pool's quote vault."
          ],
          "writable": true
        },
        {
          "name": "position",
          "docs": [
            "Position PDA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "position.nonce",
                "account": "position"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "deposits",
          "type": {
            "vec": {
              "defined": {
                "name": "binLiquidityDeposit"
              }
            }
          }
        }
      ]
    },
    {
      "name": "claimHolderRewards",
      "docs": [
        "Claims holder rewards for CIPHER token holders.",
        "**STAKING REQUIRED**: Users claim based on time-weighted staked CIPHER amount.",
        "**PREREQUISITES**:",
        "- User must call init_user_holder_state first",
        "- User must stake CIPHER in Streamflow",
        "- User must call sync_holder_stake at least once",
        "Rewards are calculated using Q128 index-based tracking (same as Uniswap V3).",
        "",
        "# Process",
        "1. Validate user has synced via sync_holder_stake (last_sync_time > 0)",
        "2. Calculate current period rewards: (current_index - entry_index) * staked_amount / Q128",
        "3. Calculate total claimable: pending_rewards + current_period_rewards",
        "4. Transfer from holders_fee_vault to user",
        "5. Update user state: clear pending, reset entry_index, increment total_claimed",
        "",
        "# Security",
        "- FLASH LOAN PROTECTION: Uses synced staked_amount from user state, NOT live balance",
        "- Time-weighted: Rewards only accumulate during staking periods",
        "- Checkpoint-based: sync_holder_stake verifies stake via Streamflow CPI",
        "- Index updated after claim (prevents double-claiming)",
        "- Claimable bounded by vault balance"
      ],
      "discriminator": [
        79,
        182,
        142,
        158,
        108,
        127,
        120,
        174
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "Pool account (immutable, validation only)"
          ]
        },
        {
          "name": "holderGlobalState",
          "docs": [
            "Global holder state (read current index)"
          ]
        },
        {
          "name": "user",
          "docs": [
            "User claiming rewards"
          ],
          "signer": true
        },
        {
          "name": "userRewardDestination",
          "docs": [
            "User's destination token account for rewards (pool quote token)"
          ],
          "writable": true
        },
        {
          "name": "holdersFeeVault",
          "docs": [
            "Holders fee vault (source of reward tokens)"
          ],
          "writable": true
        },
        {
          "name": "userHolderState",
          "docs": [
            "User holder state (must be synced via sync_holder_stake at least once)",
            "PDA: [b\"holder_user\", user]",
            "SECURITY FIX: Added PDA seed validation to prevent wrong user state"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  108,
                  100,
                  101,
                  114,
                  95,
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "poolAuthority",
          "docs": [
            "Pool PDA authority (signs for holders_fee_vault transfer)"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claimNftRewards",
      "docs": [
        "Claims NFT rewards for CIPHER_OWLS NFT holders.",
        "**NO STAKING REQUIRED**: Users claim based on NFT ownership at claim time.",
        "**PREREQUISITE**: User must call init_user_nft_state first.",
        "**WEIGHTED BY RARITY**: Rare NFTs earn more than common (Common: 0.025, Uncommon: 0.05, Rare: 0.1).",
        "**MAX 10 NFTs PER CLAIM**: Prevents compute limit issues.",
        "",
        "# Process",
        "1. Verify each NFT (collection, ownership, rarity)",
        "2. Calculate total weight: sum(nft_rarities.map(r => r.weight()))",
        "3. Calculate claimable: (index_delta * user_weight) / Q128",
        "4. Transfer from nft_fee_vault to user",
        "5. Update user state with new index",
        "",
        "# Security",
        "- Collection verification via Metaplex (prevents fake NFTs)",
        "- Ownership verified at claim time (prevents borrowed NFT exploits)",
        "- Index updated after claim (prevents double-claiming)",
        "- Claimable bounded by vault balance"
      ],
      "discriminator": [
        155,
        218,
        162,
        252,
        207,
        252,
        197,
        230
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "Pool account (immutable, validation only)"
          ]
        },
        {
          "name": "nftGlobalState",
          "docs": [
            "Global NFT state (read current index)"
          ]
        },
        {
          "name": "user",
          "docs": [
            "User claiming rewards"
          ],
          "signer": true
        },
        {
          "name": "userRewardDestination",
          "docs": [
            "User's destination token account for rewards (pool quote token)",
            "SECURITY FIX: Added constraint validation for defense-in-depth"
          ],
          "writable": true
        },
        {
          "name": "nftFeeVault",
          "docs": [
            "NFT fee vault (source of reward tokens)",
            "SECURITY FIX: Added constraint validation for defense-in-depth"
          ],
          "writable": true
        },
        {
          "name": "userNftState",
          "docs": [
            "User NFT state (must be pre-initialized via init_user_nft_state)",
            "PDA: [b\"nft_user\", user]",
            "SECURITY FIX: Added PDA seed validation"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  102,
                  116,
                  95,
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "poolAuthority",
          "docs": [
            "Pool PDA authority (signs for nft_fee_vault transfer)",
            "SECURITY FIX: Validated against derived pool PDA in instruction body (step 3)"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claimProtocolFees",
      "docs": [
        "Claims protocol fees from fee vaults."
      ],
      "discriminator": [
        34,
        142,
        219,
        112,
        109,
        54,
        133,
        23
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "feeWithdrawAuthority",
          "signer": true
        },
        {
          "name": "creatorFeeVault",
          "writable": true
        },
        {
          "name": "creatorDestination",
          "docs": [
            "Where creator fees are finally sent (pool creator, DAO treasury, etc.)"
          ],
          "writable": true
        },
        {
          "name": "holdersFeeVault",
          "writable": true
        },
        {
          "name": "holdersDestination",
          "docs": [
            "Aggregator / distributor for token holders rewards"
          ],
          "writable": true
        },
        {
          "name": "nftFeeVault",
          "writable": true
        },
        {
          "name": "nftDestination",
          "docs": [
            "Aggregator / distributor for NFT holders rewards"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "takeCreator",
          "type": "u64"
        },
        {
          "name": "takeHolders",
          "type": "u64"
        },
        {
          "name": "takeNft",
          "type": "u64"
        }
      ]
    },
    {
      "name": "closePool",
      "docs": [
        "Closes pool (admin only)."
      ],
      "discriminator": [
        140,
        189,
        209,
        23,
        239,
        62,
        239,
        11
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "docs": [
            "Pool PDA (seeded from instruction args)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "baseMint"
              },
              {
                "kind": "arg",
                "path": "quoteMint"
              }
            ]
          }
        },
        {
          "name": "registry",
          "docs": [
            "Registry PDA (close too so you can re-init same pair)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "baseMint"
              },
              {
                "kind": "arg",
                "path": "quoteMint"
              }
            ]
          }
        },
        {
          "name": "baseVault",
          "writable": true
        },
        {
          "name": "quoteVault",
          "writable": true
        },
        {
          "name": "creatorFeeVault",
          "writable": true
        },
        {
          "name": "holdersFeeVault",
          "writable": true
        },
        {
          "name": "nftFeeVault",
          "writable": true
        },
        {
          "name": "adminBaseAta",
          "writable": true
        },
        {
          "name": "adminQuoteAta",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "baseMint",
          "type": "pubkey"
        },
        {
          "name": "quoteMint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "createBinArray",
      "docs": [
        "Creates a new BinArray account (holds 64 consecutive bins).",
        "",
        "# V2 Architecture",
        "BinArrays batch 64 bins into a single account for gas efficiency.",
        "",
        "# Arguments",
        "* `lower_bin_index` - Starting bin index (must be multiple of 64)",
        "",
        "# Example",
        "- lower_bin_index=128 → creates array covering bins 128-191",
        "- lower_bin_index=0 → creates array covering bins 0-63",
        "- lower_bin_index=-64 → creates array covering bins -64 to -1"
      ],
      "discriminator": [
        107,
        26,
        23,
        62,
        137,
        213,
        131,
        235
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "Pool that owns this bin array."
          ],
          "writable": true
        },
        {
          "name": "admin",
          "docs": [
            "Pool admin (must sign to create bins)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "binArray",
          "docs": [
            "New BinArray account to initialize.",
            "Seeds: [\"bin_array\", pool, lower_bin_index_le]",
            "lower_bin_index must be aligned to 64-bin boundaries (0, 64, 128, -64, etc.)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  110,
                  95,
                  97,
                  114,
                  114,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "arg",
                "path": "lowerBinIndex"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "lowerBinIndex",
          "type": "i32"
        }
      ]
    },
    {
      "name": "initHolderGlobalState",
      "docs": [
        "Initializes global holder reward state (ADMIN ONLY - ONE-TIME).",
        "**CRITICAL**: Must be called during deployment before any user can claim rewards.",
        "Admin pays rent (~0.128 SOL for 144 bytes).",
        "",
        "# Process",
        "1. Query CIPHER total supply LIVE (NO HARDCODING)",
        "2. Create global holder state PDA",
        "3. Initialize reward_index_q128 to 0 (no retroactive rewards)",
        "",
        "# Security",
        "- Admin-only initialization",
        "- Validates CIPHER mint address",
        "- Queries supply live (no hardcoded values)",
        "- Requires non-zero supply (prevents division by zero)"
      ],
      "discriminator": [
        21,
        10,
        69,
        39,
        195,
        87,
        203,
        148
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Signer paying rent and performing the initialization.",
            "Must match PROTOCOL_ADMIN exactly."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "cipherMint",
          "docs": [
            "CIPHER token mint used to query total supply.",
            "The address is validated in the instruction body."
          ]
        },
        {
          "name": "holderGlobalState",
          "docs": [
            "Global holder state PDA.",
            "Created once and shared across all pools."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  108,
                  100,
                  101,
                  114,
                  95,
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initNftGlobalState",
      "docs": [
        "Initializes global NFT reward state (ADMIN ONLY - ONE-TIME).",
        "**CRITICAL**: Must be called during deployment before any user can claim NFT rewards.",
        "Admin pays rent (~0.128 SOL for 144 bytes).",
        "",
        "# Process",
        "1. Create global NFT state PDA",
        "2. Initialize reward_index_q128 to 0 (no retroactive rewards)",
        "",
        "# Security",
        "- Admin-only initialization",
        "- Index starts at 0 (prevents retroactive claims)",
        "- Total collection weight is constant (20,475 verified via Metaplex)"
      ],
      "discriminator": [
        126,
        182,
        160,
        21,
        28,
        63,
        16,
        75
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Signer paying rent and performing the initialization.",
            "Must match PROTOCOL_ADMIN exactly."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "nftGlobalState",
          "docs": [
            "Global NFT state PDA.",
            "Created once and shared across all pools."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  102,
                  116,
                  95,
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initPool",
      "docs": [
        "Initializes a new liquidity pool (state + lp_mint + registry)."
      ],
      "discriminator": [
        116,
        233,
        199,
        204,
        115,
        159,
        171,
        36
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Pays for initialization, becomes pool admin (can be rotated later)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "creator"
        },
        {
          "name": "baseMintAccount"
        },
        {
          "name": "quoteMintAccount"
        },
        {
          "name": "pool",
          "docs": [
            "Pool state account (PDA), zero_copy for stack efficiency."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "baseMint"
              },
              {
                "kind": "arg",
                "path": "quoteMint"
              }
            ]
          }
        },
        {
          "name": "lpMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "docs": [
            "Pair registry PDA to prevent duplicate pools."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "baseMint"
              },
              {
                "kind": "arg",
                "path": "quoteMint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "baseMint",
          "type": "pubkey"
        },
        {
          "name": "quoteMint",
          "type": "pubkey"
        },
        {
          "name": "binStepBps",
          "type": "u16"
        },
        {
          "name": "initialPriceQ6464",
          "type": "u128"
        },
        {
          "name": "feeConfig",
          "type": {
            "defined": {
              "name": "feeConfig"
            }
          }
        },
        {
          "name": "accountingMode",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initPoolVaults",
      "docs": [
        "Initializes the pool’s vault token accounts and writes them into Pool."
      ],
      "discriminator": [
        209,
        118,
        61,
        154,
        158,
        189,
        162,
        244
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "Payer for account creations"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "docs": [
            "Pool PDA (already initialized by `init_pool`)"
          ],
          "writable": true
        },
        {
          "name": "baseMint",
          "docs": [
            "Base mint (not deserialized to save stack space, validated by token::mint constraint)"
          ]
        },
        {
          "name": "quoteMint",
          "docs": [
            "Quote mint (not deserialized to save stack space, validated by token::mint constraint)"
          ]
        },
        {
          "name": "baseVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  115,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "quoteVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "creatorFeeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  102,
                  101,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "holdersFeeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  108,
                  100,
                  101,
                  114,
                  115,
                  95,
                  102,
                  101,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "nftFeeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "const",
                "value": [
                  110,
                  102,
                  116,
                  95,
                  102,
                  101,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "protocolFeeVault",
          "docs": [
            "Protocol fee vault (12.5% of total swap fees, token::authority = pool)",
            "Can be permissionlessly swept to Squads multisig via transfer_protocol_fees instruction"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  102,
                  101,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initPosition",
      "docs": [
        "init a liquidity position single OR 2-sided"
      ],
      "discriminator": [
        197,
        20,
        10,
        1,
        97,
        160,
        177,
        91
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initPositionBin",
      "docs": [
        "Initializes a PositionBin account binding a Position to a specific LiquidityBin.",
        "This is usually called once per bin you want to deposit into (or created lazily)."
      ],
      "discriminator": [
        249,
        110,
        124,
        16,
        185,
        55,
        149,
        13
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "position",
          "docs": [
            "Position PDA (canonical seeds), ensures owner & pool binding"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "position.nonce",
                "account": "position"
              }
            ]
          }
        },
        {
          "name": "positionBin",
          "docs": [
            "PositionBin PDA (canonical)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  95,
                  98,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "position"
              },
              {
                "kind": "arg",
                "path": "binIndex"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "binIndex",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initUserHolderState",
      "docs": [
        "Initializes user holder state for CIPHER holder rewards.",
        "**PREREQUISITE**: init_holder_global_state must be called first.",
        "**PREREQUISITE**: Must be called before first claim_holder_rewards call.",
        "User pays rent (~0.128 SOL for 144 bytes).",
        "",
        "# Process",
        "1. Create user holder state PDA",
        "2. Initialize with current global index (prevents retroactive rewards)",
        "",
        "# Security",
        "- Permissionless but harmless (just creates tracking account)",
        "- Initializes with current index (no retroactive rewards)"
      ],
      "discriminator": [
        49,
        178,
        188,
        199,
        246,
        133,
        51,
        222
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Payer for account creation"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "user",
          "docs": [
            "User this state is for (does not need to sign)"
          ]
        },
        {
          "name": "holderGlobalState",
          "docs": [
            "Global holder state (read current index for initialization)"
          ]
        },
        {
          "name": "userHolderState",
          "docs": [
            "User holder state (initialized)",
            "PDA: [b\"holder_user\", user]"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  108,
                  100,
                  101,
                  114,
                  95,
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initUserNftState",
      "docs": [
        "Initializes user NFT state for CIPHER_OWLS NFT holder rewards.",
        "**PREREQUISITE**: init_nft_global_state must be called first.",
        "**PREREQUISITE**: Must be called before first claim_nft_rewards call.",
        "User pays rent (~0.128 SOL for 144 bytes).",
        "",
        "# Process",
        "1. Create user NFT state PDA",
        "2. Initialize with current global index (prevents retroactive rewards)",
        "",
        "# Security",
        "- Permissionless but harmless (just creates tracking account)",
        "- Initializes with current index (no retroactive rewards)"
      ],
      "discriminator": [
        175,
        85,
        43,
        138,
        194,
        163,
        71,
        36
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Payer for account creation"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "user",
          "docs": [
            "User this state is for (does not need to sign)"
          ]
        },
        {
          "name": "nftGlobalState",
          "docs": [
            "Global NFT state (read current index for initialization)"
          ]
        },
        {
          "name": "userNftState",
          "docs": [
            "User NFT state (initialized)",
            "PDA: [b\"nft_user\", user]"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  102,
                  116,
                  95,
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "lockLiquidity",
      "docs": [
        "Locks liquidity metadata."
      ],
      "discriminator": [
        179,
        201,
        236,
        158,
        212,
        98,
        70,
        182
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "Pool state (PDA) - validated in function body"
          ],
          "writable": true
        },
        {
          "name": "liquidityLock",
          "docs": [
            "Per-user lock record (PDA) - manually initialized"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "user",
          "docs": [
            "User who owns the lock record"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "userLp",
          "docs": [
            "User LP account to validate they have enough tokens and transfer from"
          ],
          "writable": true
        },
        {
          "name": "lpMint"
        },
        {
          "name": "escrowLp",
          "docs": [
            "Escrow account owned by pool PDA to hold locked LP tokens"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "lockDuration",
          "type": "i64"
        }
      ]
    },
    {
      "name": "setPause",
      "docs": [
        "Pauses or unpauses the pool."
      ],
      "discriminator": [
        63,
        32,
        154,
        2,
        56,
        103,
        79,
        45
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "pause",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setPauseBits",
      "docs": [
        "Sets pause bits for the pool (pause_guardian only)."
      ],
      "discriminator": [
        122,
        45,
        85,
        156,
        176,
        64,
        45,
        83
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "pauseGuardian",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newBits",
          "type": "u8"
        }
      ]
    },
    {
      "name": "swapV2",
      "docs": [
        "Executes a swap using BinArray architecture with accounting validation.",
        "",
        "# V2 Features",
        "- Traverses bins across multiple BinArrays efficiently",
        "- Updates fee growth on each bin touched (auto-compounding)",
        "- Post-swap validation: sum(bin_reserves) == vault_balances",
        "- Fails transaction if accounting drift detected",
        "",
        "# Security",
        "Stricter than legacy swap - fails loud on accounting errors."
      ],
      "discriminator": [
        43,
        4,
        237,
        11,
        26,
        201,
        30,
        98
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "userSource",
          "docs": [
            "User's source token account (validated in function)",
            "SECURITY FIX: Added ownership constraint"
          ],
          "writable": true
        },
        {
          "name": "userDestination",
          "docs": [
            "User's destination token account (validated in function)",
            "SECURITY FIX: Added ownership constraint"
          ],
          "writable": true
        },
        {
          "name": "baseVault",
          "docs": [
            "Pool's base vault (validated in function)"
          ],
          "writable": true
        },
        {
          "name": "quoteVault",
          "docs": [
            "Pool's quote vault (validated in function)"
          ],
          "writable": true
        },
        {
          "name": "protocolFeeVault",
          "docs": [
            "Protocol fee vault (12.5% of total swap fees)"
          ],
          "writable": true
        },
        {
          "name": "creatorFeeVault",
          "docs": [
            "Creator fee vault (validated in function)"
          ],
          "writable": true
        },
        {
          "name": "holdersFeeVault",
          "docs": [
            "Holders fee vault (validated in function)"
          ],
          "writable": true
        },
        {
          "name": "nftFeeVault",
          "docs": [
            "NFT fee vault (validated in function)"
          ],
          "writable": true
        },
        {
          "name": "cipherMint",
          "docs": [
            "CIPHER token mint (for live supply query in index calculation)"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amountIn",
          "type": "u64"
        },
        {
          "name": "minAmountOut",
          "type": "u64"
        },
        {
          "name": "route",
          "type": {
            "defined": {
              "name": "swapRouteV2"
            }
          }
        }
      ]
    },
    {
      "name": "syncHolderStake",
      "docs": [
        "Synchronizes user's staked CIPHER amount for time-weighted rewards.",
        "**CRITICAL**: Must be called after every stake/unstake in Streamflow.",
        "**CRITICAL**: Must be called at least once before first claim_holder_rewards.",
        "User pays rent on first sync (~0.156 SOL for 176 bytes).",
        "",
        "# Process",
        "1. Verify actual stake amount from Streamflow StakeEntry account (on-chain)",
        "2. Calculate rewards accrued during previous stake period",
        "3. Add accrued to pending_rewards (preserves across periods)",
        "4. Update staked amount to verified value (trustless)",
        "5. Reset entry_index to current global index",
        "",
        "# Arguments",
        "- stake_pool_address: Streamflow stake pool address (for PDA derivation)",
        "- stake_entry_nonce: Nonce for the user's StakeEntry (for PDA derivation)",
        "",
        "# Security",
        "- ✅ SECURITY FIX: On-chain verification via Streamflow StakeEntry",
        "- ✅ No user-provided amount (trustless)",
        "- ✅ Verifies stake belongs to correct pool and authority",
        "- Economic security: Can't drain more than proportional share",
        "- First sync starts from current index (no retroactive rewards)",
        "- Pending rewards preserve across stake periods (fair accumulation)",
        "",
        "# Integration with Streamflow",
        "- Streamflow Program: STAKEvGqQTtzJZH6BWDcbpzXXn2BBerPAgQ3EGLN2GH",
        "- CIPHER Mint: Ciphern9cCXtms66s8Mm6wCFC27b2JProRQLYmiLMH3N",
        "- Frontend must pass correct StakeEntry account and nonce"
      ],
      "discriminator": [
        151,
        230,
        186,
        138,
        237,
        187,
        231,
        155
      ],
      "accounts": [
        {
          "name": "holderGlobalState",
          "docs": [
            "Global holder reward state (for current index)"
          ],
          "writable": true
        },
        {
          "name": "userHolderState",
          "docs": [
            "User's holder state (checkpoint tracking)",
            "MUST be pre-initialized via init_user_holder_state instruction",
            "PDA: [b\"holder_user\", user]",
            "SECURITY FIX: Added PDA seed validation"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  108,
                  100,
                  101,
                  114,
                  95,
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "docs": [
            "User (signer)"
          ],
          "signer": true
        },
        {
          "name": "streamflowStakeEntry",
          "docs": [
            "SECURITY FIX: Streamflow StakeEntry account for verification",
            "PDA: [b\"stake-entry\", stake_pool, authority, nonce]",
            "This account proves the user's actual staked amount on-chain",
            "",
            "1. Account is owned by Streamflow program",
            "2. Deserialization succeeds (proves correct discriminator)",
            "3. Authority matches user",
            "4. Stake pool matches expected CIPHER pool"
          ]
        },
        {
          "name": "streamflowProgram",
          "docs": [
            "SECURITY FIX: Streamflow program for verification"
          ]
        }
      ],
      "args": [
        {
          "name": "stakePoolAddress",
          "type": "pubkey"
        },
        {
          "name": "stakeEntryNonce",
          "type": "u32"
        }
      ]
    },
    {
      "name": "transferProtocolFees",
      "docs": [
        "Transfers protocol fees to Squads multisig vault.",
        "**PERMISSIONLESS**: Anyone can call this to sweep protocol fees.",
        "The protocol fee (12.5% of total swap fees) is automatically collected",
        "and can be transferred to the hardcoded Squads vault for protocol treasury.",
        "",
        "# Arguments",
        "* `amount` - Amount to transfer (0 = transfer full protocol_fee_vault balance)",
        "",
        "# Security",
        "- Destination hardcoded to prevent redirect attacks",
        "- Mint validation ensures correct token",
        "- Pool PDA authority ensures only pool can sign"
      ],
      "discriminator": [
        142,
        148,
        70,
        57,
        116,
        166,
        82,
        111
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "Pool account (immutable, just need to read quote_mint and bump)"
          ]
        },
        {
          "name": "protocolFeeVault",
          "docs": [
            "Protocol fee vault PDA (validated against pool.protocol_fee_vault)"
          ],
          "writable": true
        },
        {
          "name": "squadsVaultDestination",
          "docs": [
            "Squads vault destination token account",
            "Must match SQUADS_VAULT constant and pool quote_mint"
          ],
          "writable": true
        },
        {
          "name": "poolAuthority",
          "docs": [
            "Pool PDA authority (signs for protocol_fee_vault transfer)"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "unlockLiquidity",
      "docs": [
        "Unlock liquidity (if you implemented lock/unlock with escrow)."
      ],
      "discriminator": [
        154,
        98,
        151,
        31,
        8,
        180,
        144,
        1
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "Pool state (PDA)"
          ],
          "writable": true
        },
        {
          "name": "liquidityLock",
          "docs": [
            "Per-user liquidity lock PDA"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "user",
          "docs": [
            "User who owns the lock"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "userLp",
          "docs": [
            "User LP account to receive unlocked tokens"
          ],
          "writable": true
        },
        {
          "name": "escrowLp",
          "docs": [
            "Escrow LP account owned by pool PDA"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateAdmin",
      "docs": [
        "Updates the pool admin (admin only)."
      ],
      "discriminator": [
        161,
        176,
        40,
        213,
        60,
        184,
        179,
        228
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "SECURITY FIX: Added constraint to validate admin authority at account level (defense-in-depth)"
          ],
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateAuthorities",
      "docs": [
        "Updates pool authorities (admin only)."
      ],
      "discriminator": [
        175,
        228,
        137,
        18,
        175,
        70,
        220,
        165
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "Pool account with admin validation",
            "SECURITY FIX: Added has_one constraint to enforce admin authorization"
          ],
          "writable": true
        },
        {
          "name": "admin",
          "docs": [
            "Admin signer (must match pool.admin)"
          ],
          "signer": true,
          "relations": [
            "pool"
          ]
        }
      ],
      "args": [
        {
          "name": "configAuthority",
          "type": "pubkey"
        },
        {
          "name": "pauseGuardian",
          "type": "pubkey"
        },
        {
          "name": "feeWithdrawAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateFeeConfig",
      "docs": [
        "Updates the pool fee configuration."
      ],
      "discriminator": [
        104,
        184,
        103,
        242,
        88,
        151,
        107,
        20
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newFeeConfig",
          "type": {
            "defined": {
              "name": "feeConfig"
            }
          }
        }
      ]
    },
    {
      "name": "viewFarmingPosition",
      "docs": [
        "View farming position analytics (read-only).",
        "",
        "Returns comprehensive position data without modifying state:",
        "- Position shares and ownership",
        "- Current reserves (position's share of bin liquidity)",
        "- Accrued fees (auto-compounding via Q128 fee growth)",
        "- Total value (reserves + fees)",
        "",
        "**Use Case:**",
        "Frontend dashboard to display \"farming\" positions and their accumulated value.",
        "",
        "# Returns",
        "FarmingPositionView struct serialized in transaction return data."
      ],
      "discriminator": [
        29,
        39,
        65,
        136,
        187,
        153,
        243,
        130
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "Pool account (validation only)"
          ]
        },
        {
          "name": "position",
          "docs": [
            "Position account"
          ]
        },
        {
          "name": "positionBin",
          "docs": [
            "PositionBin account"
          ]
        },
        {
          "name": "binArray",
          "docs": [
            "BinArray containing the bin"
          ]
        }
      ],
      "args": [],
      "returns": {
        "defined": {
          "name": "farmingPositionView"
        }
      }
    },
    {
      "name": "withdrawV2",
      "docs": [
        "Withdraws liquidity from multiple bins with auto-compounded fee distribution.",
        "",
        "# V2 Features",
        "- Calculates accrued fees: (current_fee_growth - initial_fee_growth) * shares",
        "- Distributes fees automatically (no separate claim needed)",
        "- Validates vault balance decreases match expected amounts",
        "- Post-withdrawal accounting validation",
        "- Completeness check: all relevant bins must be included",
        "",
        "# Fee Distribution",
        "Fees are auto-compounded - withdrawal includes proportional share of all fees",
        "earned since deposit. No separate claiming required."
      ],
      "discriminator": [
        242,
        80,
        163,
        0,
        196,
        221,
        194,
        194
      ],
      "accounts": [
        {
          "name": "pool",
          "docs": [
            "Pool (zero-copy)."
          ],
          "writable": true
        },
        {
          "name": "owner",
          "docs": [
            "Position owner (signs)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "ownerBase",
          "docs": [
            "Owner's base token account."
          ],
          "writable": true
        },
        {
          "name": "ownerQuote",
          "docs": [
            "Owner's quote token account."
          ],
          "writable": true
        },
        {
          "name": "baseVault",
          "docs": [
            "Pool's base vault."
          ],
          "writable": true
        },
        {
          "name": "quoteVault",
          "docs": [
            "Pool's quote vault."
          ],
          "writable": true
        },
        {
          "name": "position",
          "docs": [
            "Position PDA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "position.nonce",
                "account": "position"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "withdrawals",
          "type": {
            "vec": {
              "defined": {
                "name": "binWithdrawal"
              }
            }
          }
        },
        {
          "name": "minBaseOut",
          "type": "u64"
        },
        {
          "name": "minQuoteOut",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "binArray",
      "discriminator": [
        92,
        142,
        92,
        220,
        5,
        148,
        70,
        181
      ]
    },
    {
      "name": "holderGlobalState",
      "discriminator": [
        201,
        13,
        55,
        112,
        49,
        124,
        252,
        241
      ]
    },
    {
      "name": "liquidityLock",
      "discriminator": [
        154,
        210,
        64,
        149,
        2,
        60,
        4,
        78
      ]
    },
    {
      "name": "nftGlobalState",
      "discriminator": [
        153,
        133,
        196,
        53,
        53,
        146,
        35,
        130
      ]
    },
    {
      "name": "pairRegistry",
      "discriminator": [
        180,
        142,
        99,
        6,
        243,
        194,
        134,
        152
      ]
    },
    {
      "name": "pool",
      "discriminator": [
        241,
        154,
        109,
        4,
        17,
        177,
        109,
        188
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    },
    {
      "name": "positionBin",
      "discriminator": [
        145,
        172,
        1,
        90,
        204,
        13,
        245,
        171
      ]
    },
    {
      "name": "userHolderState",
      "discriminator": [
        109,
        105,
        38,
        190,
        82,
        186,
        180,
        81
      ]
    },
    {
      "name": "userNftState",
      "discriminator": [
        41,
        154,
        221,
        64,
        116,
        186,
        73,
        171
      ]
    }
  ],
  "events": [
    {
      "name": "adminUpdated",
      "discriminator": [
        69,
        82,
        49,
        171,
        43,
        3,
        80,
        161
      ]
    },
    {
      "name": "authoritiesUpdated",
      "discriminator": [
        67,
        41,
        36,
        180,
        223,
        84,
        221,
        76
      ]
    },
    {
      "name": "binArrayCreated",
      "discriminator": [
        124,
        208,
        24,
        108,
        92,
        150,
        57,
        156
      ]
    },
    {
      "name": "binLiquidityUpdated",
      "discriminator": [
        75,
        48,
        154,
        36,
        109,
        209,
        141,
        126
      ]
    },
    {
      "name": "claimHolderRewardsEvent",
      "discriminator": [
        97,
        42,
        168,
        9,
        85,
        193,
        87,
        102
      ]
    },
    {
      "name": "feeConfigUpdated",
      "discriminator": [
        45,
        50,
        42,
        173,
        193,
        67,
        52,
        244
      ]
    },
    {
      "name": "feesDistributed",
      "discriminator": [
        209,
        24,
        174,
        200,
        236,
        90,
        154,
        55
      ]
    },
    {
      "name": "liquidityBinCreated",
      "discriminator": [
        193,
        62,
        251,
        203,
        209,
        242,
        92,
        48
      ]
    },
    {
      "name": "liquidityDeposited",
      "discriminator": [
        218,
        155,
        74,
        193,
        59,
        66,
        94,
        122
      ]
    },
    {
      "name": "liquidityLocked",
      "discriminator": [
        150,
        201,
        204,
        183,
        217,
        13,
        119,
        185
      ]
    },
    {
      "name": "liquidityWithdrawnAdmin",
      "discriminator": [
        236,
        107,
        253,
        125,
        227,
        157,
        155,
        123
      ]
    },
    {
      "name": "liquidityWithdrawnUser",
      "discriminator": [
        142,
        245,
        211,
        16,
        66,
        171,
        36,
        40
      ]
    },
    {
      "name": "pairRegistered",
      "discriminator": [
        125,
        143,
        112,
        66,
        5,
        53,
        110,
        4
      ]
    },
    {
      "name": "pauseUpdated",
      "discriminator": [
        203,
        203,
        33,
        225,
        130,
        103,
        90,
        105
      ]
    },
    {
      "name": "poolInitialized",
      "discriminator": [
        100,
        118,
        173,
        87,
        12,
        198,
        254,
        229
      ]
    },
    {
      "name": "swapExecuted",
      "discriminator": [
        150,
        166,
        26,
        225,
        28,
        89,
        38,
        79
      ]
    },
    {
      "name": "syncHolderStakeEvent",
      "discriminator": [
        47,
        69,
        233,
        184,
        242,
        2,
        125,
        106
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidLiquidity",
      "msg": "The provided liquidity value is invalid."
    },
    {
      "code": 6001,
      "name": "calculationError",
      "msg": "Calculation error occurred during arithmetic operations."
    },
    {
      "code": 6002,
      "name": "invalidInput",
      "msg": "The provided input data is invalid."
    },
    {
      "code": 6003,
      "name": "missingBins",
      "msg": "Missing liquidity bin accounts for withdrawal; pass all active bins in remaining_accounts."
    },
    {
      "code": 6004,
      "name": "internalInconsistency",
      "msg": "Operation aborted due to an internal inconsistency."
    },
    {
      "code": 6005,
      "name": "unknownError",
      "msg": "An unknown error has occurred."
    },
    {
      "code": 6006,
      "name": "slippageExceeded",
      "msg": "The swap operation did not meet the minimum output requirements due to slippage protection."
    },
    {
      "code": 6007,
      "name": "insufficientLiquidity",
      "msg": "The pool does not have sufficient liquidity to perform this operation."
    },
    {
      "code": 6008,
      "name": "unauthorizedOperation",
      "msg": "Unauthorized operation attempted."
    },
    {
      "code": 6009,
      "name": "invalidAuthority",
      "msg": "Invalid or missing protocol authority for this operation."
    },
    {
      "code": 6010,
      "name": "invalidAccountState",
      "msg": "The account state is invalid."
    },
    {
      "code": 6011,
      "name": "mintMismatch",
      "msg": "Token account mint does not match expected mint for this pool."
    },
    {
      "code": 6012,
      "name": "ownerMismatch",
      "msg": "Token account owner does not match expected authority."
    },
    {
      "code": 6013,
      "name": "tokenTransferFailed",
      "msg": "Token transfer failed to execute correctly."
    },
    {
      "code": 6014,
      "name": "poolPaused",
      "msg": "Pool is currently paused."
    },
    {
      "code": 6015,
      "name": "operationDisabled",
      "msg": "The requested operation is currently disabled."
    },
    {
      "code": 6016,
      "name": "migrationFailed",
      "msg": "Migration failed for this pool account."
    },
    {
      "code": 6017,
      "name": "versionMismatch",
      "msg": "On-chain version mismatch detected."
    },
    {
      "code": 6018,
      "name": "poolAlreadyExists",
      "msg": "Pool already exists for this token pair and configuration."
    },
    {
      "code": 6019,
      "name": "poolNotFound",
      "msg": "Pool not found for the requested token pair and configuration."
    },
    {
      "code": 6020,
      "name": "pairOrderingViolation",
      "msg": "Invalid pair ordering; token pair must be canonicalized."
    },
    {
      "code": 6021,
      "name": "registryViolation",
      "msg": "Pair registry constraint violated."
    },
    {
      "code": 6022,
      "name": "binAlreadyExists",
      "msg": "Liquidity bin already exists for this index."
    },
    {
      "code": 6023,
      "name": "binNotFound",
      "msg": "Liquidity bin not found for the requested index."
    },
    {
      "code": 6024,
      "name": "invalidBinBounds",
      "msg": "Invalid liquidity bin bounds."
    },
    {
      "code": 6025,
      "name": "lpTokenMismatch",
      "msg": "LP token mint or account does not match this pool."
    },
    {
      "code": 6026,
      "name": "notEnoughShares",
      "msg": "Not enough LP shares to complete this operation."
    },
    {
      "code": 6027,
      "name": "lpVaultMismatch",
      "msg": "LP vault or escrow does not match expected authority."
    },
    {
      "code": 6028,
      "name": "reentrancyDetected",
      "msg": "Reentrancy detected: operation aborted for security reasons."
    },
    {
      "code": 6029,
      "name": "priceOutOfRange",
      "msg": "Initial deposit price deviates from target"
    },
    {
      "code": 6030,
      "name": "poolNotEmpty",
      "msg": "Pool reserves must be empty on bootstrap"
    },
    {
      "code": 6031,
      "name": "invalidVaultOwner",
      "msg": "Vault is not owned by the SPL Token program"
    },
    {
      "code": 6032,
      "name": "invalidVaultAuthority",
      "msg": "Vault has an unexpected authority"
    },
    {
      "code": 6033,
      "name": "invalidVaultMint",
      "msg": "Vault has an unexpected mint"
    },
    {
      "code": 6034,
      "name": "invalidVaultData",
      "msg": "Account data is too short to be a valid SPL Token account"
    },
    {
      "code": 6035,
      "name": "activeLock",
      "msg": "Liquidity is currently locked and cannot be withdrawn until the lock period expires."
    },
    {
      "code": 6036,
      "name": "insufficientLp",
      "msg": "Insufficient LP tokens for this operation."
    },
    {
      "code": 6037,
      "name": "vaultsAlreadyInitialized",
      "msg": "Pool vaults already initialized."
    },
    {
      "code": 6038,
      "name": "wrongMode",
      "msg": "Wrong accounting mode for this instruction."
    },
    {
      "code": 6039,
      "name": "invalidTokenProgram",
      "msg": "Invalid token program."
    },
    {
      "code": 6040,
      "name": "invalidProgramOwner",
      "msg": "Invalid program-owned account."
    },
    {
      "code": 6041,
      "name": "invalidPda",
      "msg": "Invalid PDA for the provided account."
    },
    {
      "code": 6042,
      "name": "invalidRemainingAccountsLayout",
      "msg": "Invalid remaining accounts layout."
    },
    {
      "code": 6043,
      "name": "duplicateBinIndex",
      "msg": "Duplicate bin index provided."
    },
    {
      "code": 6044,
      "name": "missingPositionBin",
      "msg": "Missing position bin account."
    },
    {
      "code": 6045,
      "name": "positionPoolMismatch",
      "msg": "Position pool mismatch."
    },
    {
      "code": 6046,
      "name": "positionOwnerMismatch",
      "msg": "Position owner mismatch."
    },
    {
      "code": 6047,
      "name": "binPoolMismatch",
      "msg": "Bin pool mismatch."
    },
    {
      "code": 6048,
      "name": "positionBinPositionMismatch",
      "msg": "PositionBin position mismatch."
    },
    {
      "code": 6049,
      "name": "positionBinPoolMismatch",
      "msg": "PositionBin pool mismatch."
    },
    {
      "code": 6050,
      "name": "accountingInvariantViolation",
      "msg": "Accounting invariant violated."
    },
    {
      "code": 6051,
      "name": "insufficientPositionBinShares",
      "msg": "Insufficient position bin shares."
    },
    {
      "code": 6052,
      "name": "accountingMismatch",
      "msg": "Accounting mismatch: bin deltas do not match vault payout. Pass all active bins in remaining_accounts."
    },
    {
      "code": 6053,
      "name": "duplicateBinAccount",
      "msg": "Duplicate bin account provided."
    },
    {
      "code": 6054,
      "name": "invalidMetadata",
      "msg": "NFT metadata is invalid or cannot be parsed."
    },
    {
      "code": 6055,
      "name": "invalidNftRarity",
      "msg": "NFT rarity indicator not found or invalid in metadata name."
    }
  ],
  "types": [
    {
      "name": "adminUpdated",
      "docs": [
        "Emitted when the admin rotates to a new key."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "oldAdmin",
            "type": "pubkey"
          },
          {
            "name": "newAdmin",
            "type": "pubkey"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "authoritiesUpdated",
      "docs": [
        "Emitted when auxiliary authorities are updated."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "configAuthority",
            "type": "pubkey"
          },
          {
            "name": "pauseGuardian",
            "type": "pubkey"
          },
          {
            "name": "feeWithdrawAuthority",
            "type": "pubkey"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "binArray",
      "docs": [
        "BinArray account holding BIN_ARRAY_SIZE (64) consecutive bins.",
        "Bins are indexed as: bin_index = lower_bin_index + array_offset (0..63)",
        "",
        "PDA Derivation:",
        "seeds = [b\"bin_array\", pool.key(), lower_bin_index.to_le_bytes()]",
        "",
        "lower_bin_index is always aligned to BIN_ARRAY_SIZE boundaries:",
        "lower_bin_index = (actual_bin_index / 64) * 64",
        "",
        "Example: bin indices 128-191 are stored in BinArray with lower_bin_index=128",
        "",
        "Field order optimized to avoid padding (bins placed first after pool for proper alignment)"
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "docs": [
              "Owning pool."
            ],
            "type": "pubkey"
          },
          {
            "name": "bins",
            "docs": [
              "Packed bins (64 consecutive bins). Must be 16-byte aligned."
            ],
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "compactBin"
                  }
                },
                64
              ]
            }
          },
          {
            "name": "lowerBinIndex",
            "docs": [
              "Starting bin index for this array (always multiple of BIN_ARRAY_SIZE)."
            ],
            "type": "i32"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed."
            ],
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved for 16-byte alignment (u128 fields require struct to be 16-byte aligned)."
            ],
            "type": {
              "array": [
                "u8",
                11
              ]
            }
          }
        ]
      }
    },
    {
      "name": "binArrayCreated",
      "docs": [
        "Event emitted when a new BinArray is created."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "lowerBinIndex",
            "type": "i32"
          },
          {
            "name": "binArray",
            "type": "pubkey"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "binLiquidityDeposit",
      "docs": [
        "Per-bin liquidity deposit specification."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "binIndex",
            "docs": [
              "Bin index (canonically encoded)"
            ],
            "type": "u64"
          },
          {
            "name": "baseIn",
            "docs": [
              "Base tokens to deposit"
            ],
            "type": "u64"
          },
          {
            "name": "quoteIn",
            "docs": [
              "Quote tokens to deposit"
            ],
            "type": "u64"
          },
          {
            "name": "minSharesOut",
            "docs": [
              "Minimum shares expected (slippage protection)"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "binLiquidityUpdated",
      "docs": [
        "Emitted whenever a bin’s reserves change (e.g., deposit or swap traversal)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "binIndex",
            "type": "i64"
          },
          {
            "name": "deltaBase",
            "docs": [
              "Change in base/quote reserve (unsigned magnitudes)."
            ],
            "type": "u128"
          },
          {
            "name": "deltaQuote",
            "type": "u128"
          },
          {
            "name": "reserveBase",
            "docs": [
              "Resulting reserves after the change."
            ],
            "type": "u128"
          },
          {
            "name": "reserveQuote",
            "type": "u128"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "binWithdrawal",
      "docs": [
        "Per-bin withdrawal specification."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "binIndex",
            "docs": [
              "Bin index (canonically encoded)"
            ],
            "type": "u64"
          },
          {
            "name": "shares",
            "docs": [
              "Shares to burn from this bin"
            ],
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "claimHolderRewardsEvent",
      "docs": [
        "Emitted when user claims holder rewards based on staked CIPHER.",
        "",
        "**When Emitted:**",
        "- User calls `claim_holder_rewards()`",
        "- Only claimable if user has synced their stake at least once",
        "",
        "**Calculation:**",
        "- `current_period_claimed`: Rewards from current stake period (entry_index → current_index)",
        "- `pending_claimed`: Rewards accumulated from previous stake periods",
        "- `amount`: Total claimed (current_period + pending)",
        "",
        "**Fields:**",
        "- `user`: User's public key",
        "- `pool`: Pool address (if pool-specific) or default for global",
        "- `amount`: Total USDC (or quote token) claimed",
        "- `pending_claimed`: Portion from previous periods",
        "- `current_period_claimed`: Portion from current period",
        "- `timestamp`: Unix timestamp of claim"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u128"
          },
          {
            "name": "pendingClaimed",
            "type": "u128"
          },
          {
            "name": "currentPeriodClaimed",
            "type": "u128"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "compactBin",
      "docs": [
        "Compact bin data stored within a BinArray.",
        "bin_index is implicitly derived as: lower_bin_index + offset"
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "reserveBase",
            "docs": [
              "Actual token reserves at this bin's fixed price."
            ],
            "type": "u128"
          },
          {
            "name": "reserveQuote",
            "type": "u128"
          },
          {
            "name": "totalShares",
            "docs": [
              "Total bin shares outstanding across all positions."
            ],
            "type": "u128"
          },
          {
            "name": "feeGrowthBaseQ128",
            "docs": [
              "Cumulative fee growth per unit of share in Q128 fixed-point.",
              "Used for auto-compounding fee distribution to position holders.",
              "Updated on every swap that touches this bin."
            ],
            "type": "u128"
          },
          {
            "name": "feeGrowthQuoteQ128",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "farmingPositionView",
      "docs": [
        "Farming position view data (returned to client)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "docs": [
              "Pool pubkey"
            ],
            "type": "pubkey"
          },
          {
            "name": "position",
            "docs": [
              "Position pubkey"
            ],
            "type": "pubkey"
          },
          {
            "name": "owner",
            "docs": [
              "Position owner"
            ],
            "type": "pubkey"
          },
          {
            "name": "binIndex",
            "docs": [
              "Bin index"
            ],
            "type": "u64"
          },
          {
            "name": "shares",
            "docs": [
              "Position shares in this bin"
            ],
            "type": "u128"
          },
          {
            "name": "totalShares",
            "docs": [
              "Total shares in this bin"
            ],
            "type": "u128"
          },
          {
            "name": "reserveBase",
            "docs": [
              "Current reserves (position's share)"
            ],
            "type": "u128"
          },
          {
            "name": "reserveQuote",
            "type": "u128"
          },
          {
            "name": "accruedFeeBase",
            "docs": [
              "Accrued fees (auto-compounding)"
            ],
            "type": "u128"
          },
          {
            "name": "accruedFeeQuote",
            "type": "u128"
          },
          {
            "name": "totalValueBase",
            "docs": [
              "Total value (reserves + fees)"
            ],
            "type": "u128"
          },
          {
            "name": "totalValueQuote",
            "type": "u128"
          },
          {
            "name": "lastUpdated",
            "docs": [
              "Timestamps"
            ],
            "type": "i64"
          },
          {
            "name": "positionCreatedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "feeConfig",
      "docs": [
        "Fee distribution configuration for the pool."
      ],
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "splitHoldersMicrobps",
            "type": "u32"
          },
          {
            "name": "splitNftMicrobps",
            "type": "u32"
          },
          {
            "name": "splitCreatorExtraMicrobps",
            "type": "u32"
          },
          {
            "name": "variableFeeControl",
            "type": "u32"
          },
          {
            "name": "maxVolatilityAccumulator",
            "type": "u32"
          },
          {
            "name": "baseFeeBps",
            "type": "u16"
          },
          {
            "name": "creatorCutBps",
            "type": "u16"
          },
          {
            "name": "legacyVolatilityMultiplierBps",
            "type": "u16"
          },
          {
            "name": "filterPeriod",
            "type": "u16"
          },
          {
            "name": "decayPeriod",
            "type": "u16"
          },
          {
            "name": "reductionFactorBps",
            "type": "u16"
          },
          {
            "name": "maxDynamicFeeBps",
            "type": "u16"
          },
          {
            "name": "dynamicFeeEnabled",
            "type": "u8"
          },
          {
            "name": "feeReserved",
            "type": {
              "array": [
                "u8",
                5
              ]
            }
          }
        ]
      }
    },
    {
      "name": "feeConfigUpdated",
      "docs": [
        "Emitted whenever the fee configuration is changed."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "baseFeeBps",
            "type": "u16"
          },
          {
            "name": "creatorCutBps",
            "type": "u16"
          },
          {
            "name": "splitHoldersMicrobps",
            "type": "u32"
          },
          {
            "name": "splitNftMicrobps",
            "type": "u32"
          },
          {
            "name": "splitCreatorExtraMicrobps",
            "type": "u32"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "feesDistributed",
      "docs": [
        "Emitted when fees are split to fee vaults during swap.",
        "V2: Includes protocol fee (12.5% of total) extracted FIRST before other splits."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "totalFee",
            "type": "u64"
          },
          {
            "name": "protocolFee",
            "docs": [
              "Protocol cut (12.5% of total_fee, extracted FIRST)"
            ],
            "type": "u64"
          },
          {
            "name": "creatorFee",
            "type": "u64"
          },
          {
            "name": "holdersFee",
            "type": "u64"
          },
          {
            "name": "nftFee",
            "type": "u64"
          },
          {
            "name": "creatorExtraFee",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "holderGlobalState",
      "docs": [
        "Global state for CIPHER holder rewards across all pools.",
        "Tracks cumulative reward index using Q128 fixed-point arithmetic.",
        "",
        "**Design Philosophy:**",
        "- No staking required: Users claim based on live CIPHER balance",
        "- Q128 precision: Same as Uniswap V3 fee growth tracking (2^128 precision levels)",
        "- Global index: Aggregates rewards from all pools for simplified claiming",
        "",
        "**Index Math:**",
        "```",
        "reward_index_growth = (holder_fees * Q128) / total_cipher_supply",
        "user_claimable = (current_index - user_last_index) * user_balance / Q128",
        "```",
        "",
        "**Security:**",
        "- Index monotonically increases (prevents retroactive claims)",
        "- Overflow protected by Q128 scale",
        "- Admin-only index updates (verified in instruction)",
        "",
        "PDA Seeds: [b\"holder_global\"]",
        "Size: 144 bytes (~0.128 SOL rent-exempt)"
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalRewardsAccumulated",
            "docs": [
              "Total rewards accumulated across all pools (in quote token terms, e.g., USDC/SOL)",
              "This is a cumulative counter that only increases"
            ],
            "type": "u128"
          },
          {
            "name": "rewardIndexQ128",
            "docs": [
              "Global reward index in Q128 fixed-point format",
              "Index = cumulative_fees * Q128 / total_cipher_supply",
              "Monotonically increasing to prevent retroactive claims"
            ],
            "type": "u128"
          },
          {
            "name": "cachedTotalSupply",
            "docs": [
              "Cached total CIPHER supply (updated periodically for gas optimization)",
              "Real-time supply queried on-chain during index updates"
            ],
            "type": "u64"
          },
          {
            "name": "lastUpdated",
            "docs": [
              "Last timestamp when the index was updated",
              "Used for monitoring and preventing stale data"
            ],
            "type": "i64"
          },
          {
            "name": "admin",
            "docs": [
              "Admin authority (can update index, typically automated crank)"
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA derivation"
            ],
            "type": "u8"
          },
          {
            "name": "reserved1",
            "docs": [
              "Reserved space for future upgrades (64 bytes: 32 + 32)",
              "Prevents need for migration if we add new fields",
              "Split into two arrays due to bytemuck Pod trait limits (max 32 elements)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "reserved2",
            "type": {
              "array": [
                "u8",
                31
              ]
            }
          }
        ]
      }
    },
    {
      "name": "liquidityBinCreated",
      "docs": [
        "Emitted when a new liquidity bin is created."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "binIndex",
            "type": "u64"
          },
          {
            "name": "lowerBoundQ6464",
            "type": "u128"
          },
          {
            "name": "upperBoundQ6464",
            "type": "u128"
          },
          {
            "name": "initialTotalShares",
            "docs": [
              "Initial bin share supply (position-bin accounting)."
            ],
            "type": "u128"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "liquidityDeposited",
      "docs": [
        "Emitted when a user deposits liquidity and receives LP shares."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "baseAmount",
            "type": "u64"
          },
          {
            "name": "quoteAmount",
            "type": "u64"
          },
          {
            "name": "sharesMinted",
            "docs": [
              "LP shares minted to the user (LP mint decimals, typically 9)."
            ],
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "liquidityLock",
      "docs": [
        "Liquidity lock account."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "lockedAmount",
            "type": "u64"
          },
          {
            "name": "lockEnd",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "liquidityLocked",
      "docs": [
        "Emitted when a user locks liquidity (book-entry in current code)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "lockEnd",
            "type": "i64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "liquidityWithdrawnAdmin",
      "docs": [
        "Emitted when an admin performs a legacy/admin-only withdrawal."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "baseAmountOut",
            "type": "u64"
          },
          {
            "name": "quoteAmountOut",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "liquidityWithdrawnUser",
      "docs": [
        "Emitted when a user withdraws by burning LP shares."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "sharesBurned",
            "type": "u64"
          },
          {
            "name": "baseAmountOut",
            "type": "u64"
          },
          {
            "name": "quoteAmountOut",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "nftGlobalState",
      "docs": [
        "Global state for NFT holder rewards across all pools.",
        "Tracks cumulative reward index using Q128 fixed-point arithmetic.",
        "",
        "**Design Philosophy:**",
        "- No staking required: Users claim based on NFT ownership at claim time",
        "- Q128 precision: Same as holder rewards (2^128 precision levels)",
        "- Weighted by rarity: Rare NFTs earn more than common",
        "- Global index: Aggregates rewards from all pools for simplified claiming",
        "",
        "**Index Math:**",
        "```",
        "reward_index_growth = (nft_fees * Q128) / total_collection_weight",
        "user_claimable = (current_index - user_last_index) * user_nft_weight / Q128",
        "```",
        "",
        "**Security:**",
        "- Index monotonically increases (prevents retroactive claims)",
        "- Overflow protected by Q128 scale",
        "- Admin-only index updates (verified in instruction)",
        "",
        "PDA Seeds: [b\"nft_global\"]",
        "Size: 144 bytes (~0.128 SOL rent-exempt)"
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalRewardsAccumulated",
            "docs": [
              "Total rewards accumulated across all pools (in quote token terms)",
              "This is a cumulative counter that only increases"
            ],
            "type": "u128"
          },
          {
            "name": "rewardIndexQ128",
            "docs": [
              "Global reward index in Q128 fixed-point format",
              "Index = cumulative_fees * Q128 / total_collection_weight",
              "Monotonically increasing to prevent retroactive claims"
            ],
            "type": "u128"
          },
          {
            "name": "lastUpdated",
            "docs": [
              "Last timestamp when the index was updated",
              "Used for monitoring and preventing stale data"
            ],
            "type": "i64"
          },
          {
            "name": "admin",
            "docs": [
              "Admin authority (can update index, typically automated crank)"
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA derivation"
            ],
            "type": "u8"
          },
          {
            "name": "pad",
            "docs": [
              "Additional padding for alignment"
            ],
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          },
          {
            "name": "reserved1",
            "docs": [
              "Reserved space for future upgrades (64 bytes: 32 + 32)",
              "Prevents need for migration if we add new fields",
              "Split into two arrays due to bytemuck Pod trait limits (max 32 elements)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "reserved2",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "pairRegistered",
      "docs": [
        "Emitted if you keep a separate register_pair instruction (factory/registry path)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "binStepBps",
            "type": "u16"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pairRegistry",
      "docs": [
        "Pair registry to prevent duplicate pools beyond canonical ordering.",
        "PDA seeds: [b\"registry\", base_mint, quote_mint] (where base_mint < quote_mint)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "baseMint",
            "docs": [
              "Canonical pair (base < quote)"
            ],
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "docs": [
              "Pool address created for this pair."
            ],
            "type": "pubkey"
          },
          {
            "name": "binStepBps",
            "docs": [
              "Bin step used by this pool (bps)."
            ],
            "type": "u16"
          },
          {
            "name": "createdAt",
            "docs": [
              "Creation timestamp."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed."
            ],
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved for future config (e.g., flags)."
            ],
            "type": {
              "array": [
                "u8",
                13
              ]
            }
          }
        ]
      }
    },
    {
      "name": "pauseUpdated",
      "docs": [
        "Emitted when pause bitmask changes."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "docs": [
              "Bitmask of paused features (see state/flags.rs):",
              "PAUSE_SWAP | PAUSE_DEPOSIT | PAUSE_WITHDRAW"
            ],
            "type": "u8"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pool",
      "docs": [
        "Main pool account holding configuration, authorities, price cache and vaults.",
        "Fields are ordered to minimize padding for zero-copy compatibility."
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "configAuthority",
            "type": "pubkey"
          },
          {
            "name": "pauseGuardian",
            "type": "pubkey"
          },
          {
            "name": "feeWithdrawAuthority",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "baseVault",
            "type": "pubkey"
          },
          {
            "name": "quoteVault",
            "type": "pubkey"
          },
          {
            "name": "creatorFeeVault",
            "type": "pubkey"
          },
          {
            "name": "holdersFeeVault",
            "type": "pubkey"
          },
          {
            "name": "nftFeeVault",
            "type": "pubkey"
          },
          {
            "name": "protocolFeeVault",
            "docs": [
              "Protocol fee vault (12.5% of total swap fees)",
              "Can be permissionlessly swept to Squads multisig"
            ],
            "type": "pubkey"
          },
          {
            "name": "lpMint",
            "type": "pubkey"
          },
          {
            "name": "priceQ6464",
            "type": "u128"
          },
          {
            "name": "totalShares",
            "type": "u128"
          },
          {
            "name": "totalHolderUnits",
            "type": "u128"
          },
          {
            "name": "totalNftUnits",
            "type": "u128"
          },
          {
            "name": "rewardIndexes",
            "type": {
              "defined": {
                "name": "rewardIndexes"
              }
            }
          },
          {
            "name": "lastUpdated",
            "type": "i64"
          },
          {
            "name": "lastSwapTime",
            "docs": [
              "Legacy: timestamp of last swap (can be used for analytics/legacy)"
            ],
            "type": "i64"
          },
          {
            "name": "lastVolatilityUpdate",
            "docs": [
              "timestamp of last volatility update"
            ],
            "type": "i64"
          },
          {
            "name": "initialBinId",
            "type": "i32"
          },
          {
            "name": "activeBin",
            "type": "i32"
          },
          {
            "name": "previousBin",
            "type": "i32"
          },
          {
            "name": "referenceBin",
            "type": "i32"
          },
          {
            "name": "splitHoldersMicrobps",
            "type": "u32"
          },
          {
            "name": "splitNftMicrobps",
            "type": "u32"
          },
          {
            "name": "splitCreatorExtraMicrobps",
            "type": "u32"
          },
          {
            "name": "variableFeeControl",
            "docs": [
              "variable_fee_control (C)"
            ],
            "type": "u32"
          },
          {
            "name": "maxVolatilityAccumulator",
            "docs": [
              "cap on va accumulator"
            ],
            "type": "u32"
          },
          {
            "name": "volatilityReference",
            "docs": [
              "vr state"
            ],
            "type": "u32"
          },
          {
            "name": "volatilityAccumulator",
            "docs": [
              "va state"
            ],
            "type": "u32"
          },
          {
            "name": "binStepBps",
            "type": "u16"
          },
          {
            "name": "baseFeeBps",
            "type": "u16"
          },
          {
            "name": "creatorCutBps",
            "type": "u16"
          },
          {
            "name": "legacyVolatilityMultiplierBps",
            "type": "u16"
          },
          {
            "name": "filterPeriod",
            "docs": [
              "seconds"
            ],
            "type": "u16"
          },
          {
            "name": "decayPeriod",
            "type": "u16"
          },
          {
            "name": "reductionFactorBps",
            "docs": [
              "0..=10000"
            ],
            "type": "u16"
          },
          {
            "name": "maxDynamicFeeBps",
            "docs": [
              "Cap on total fee (base + variable)"
            ],
            "type": "u16"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "pauseBits",
            "type": "u8"
          },
          {
            "name": "accountingMode",
            "docs": [
              "Accounting mode:",
              "0 = legacy global LP shares",
              "1 = position-bin shares"
            ],
            "type": "u8"
          },
          {
            "name": "dynamicFeeEnabled",
            "docs": [
              "Dynamic fee enabled flag (0 = disabled, 1 = enabled)"
            ],
            "type": "u8"
          },
          {
            "name": "feeReserved",
            "docs": [
              "Reserved for future parameters (and padding)"
            ],
            "type": {
              "array": [
                "u8",
                5
              ]
            }
          },
          {
            "name": "pad2",
            "docs": [
              "Explicit padding to bring total struct size to a multiple of 8"
            ],
            "type": {
              "array": [
                "u8",
                2
              ]
            }
          }
        ]
      }
    },
    {
      "name": "poolInitialized",
      "docs": [
        "Emitted once when a pool is initialized."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "binStepBps",
            "type": "u16"
          },
          {
            "name": "initialPriceQ6464",
            "type": "u128"
          },
          {
            "name": "baseFeeBps",
            "type": "u16"
          },
          {
            "name": "creatorCutBps",
            "type": "u16"
          },
          {
            "name": "splitHoldersMicrobps",
            "type": "u32"
          },
          {
            "name": "splitNftMicrobps",
            "type": "u32"
          },
          {
            "name": "splitCreatorExtraMicrobps",
            "type": "u32"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "position",
      "docs": [
        "A Position represents *ownership authority* in a pool.",
        "It does NOT store liquidity. All accounting is per-bin in PositionBin.",
        "",
        "PDA seeds (canonical):",
        "[POSITION_SEED, pool, owner, nonce_le]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "docs": [
              "Owning pool"
            ],
            "type": "pubkey"
          },
          {
            "name": "owner",
            "docs": [
              "Owner of this position"
            ],
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "docs": [
              "Optional user-defined nonce to allow multiple positions per pool"
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Creation timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "lastUpdated",
            "docs": [
              "Last updated timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved for future use (alignment + upgrades)"
            ],
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          }
        ]
      }
    },
    {
      "name": "positionBin",
      "docs": [
        "A PositionBin represents how many bin-shares",
        "a specific Position owns in a specific LiquidityBin.",
        "",
        "PDA seeds (canonical):",
        "[POSITION_BIN_SEED, position, bin_index_le]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "position",
            "docs": [
              "Parent position"
            ],
            "type": "pubkey"
          },
          {
            "name": "pool",
            "docs": [
              "Owning pool (redundant but useful for validation)"
            ],
            "type": "pubkey"
          },
          {
            "name": "binIndex",
            "docs": [
              "Bin index this position participates in"
            ],
            "type": "u64"
          },
          {
            "name": "shares",
            "docs": [
              "Bin shares owned by this position.",
              "These are claims on LiquidityBin reserves via:",
              "amount_out = reserves * shares_burn / total_shares"
            ],
            "type": "u128"
          },
          {
            "name": "feeGrowthBaseQ128",
            "docs": [
              "Accrued fees (optional, future use)"
            ],
            "type": "u128"
          },
          {
            "name": "feeGrowthQuoteQ128",
            "type": "u128"
          },
          {
            "name": "lastUpdated",
            "docs": [
              "Last update timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved for upgrades / alignment"
            ],
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          }
        ]
      }
    },
    {
      "name": "rewardIndexes",
      "docs": [
        "Tracks accumulated reward indexes for holders and NFT stakers."
      ],
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "holdersQ128",
            "type": "u128"
          },
          {
            "name": "nftQ128",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "swapExecuted",
      "docs": [
        "Emitted on each swap execution."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "inMint",
            "type": "pubkey"
          },
          {
            "name": "outMint",
            "type": "pubkey"
          },
          {
            "name": "amountIn",
            "type": "u64"
          },
          {
            "name": "amountOut",
            "type": "u64"
          },
          {
            "name": "totalFee",
            "docs": [
              "Total fee charged (token domain depends on direction; commonly quote)."
            ],
            "type": "u64"
          },
          {
            "name": "priceAfterQ6464",
            "docs": [
              "Post-swap price marker in Q64.64."
            ],
            "type": "u128"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "swapRouteV2",
      "docs": [
        "Swap route specifying bin indices to traverse.",
        "For BinArray architecture, bins can span multiple arrays."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "binIndices",
            "docs": [
              "Ordered bin indices (best price -> worst price)"
            ],
            "type": {
              "vec": "i32"
            }
          }
        ]
      }
    },
    {
      "name": "syncHolderStakeEvent",
      "docs": [
        "Emitted when user synchronizes their staked CIPHER amount for time-weighted rewards.",
        "This is a checkpoint that records stake entry/exit for proper reward calculation.",
        "",
        "**When Emitted:**",
        "- After user stakes/unstakes CIPHER in Streamflow (external program)",
        "- On first sync (initialization)",
        "- User must call `sync_holder_stake()` after each Streamflow stake change",
        "",
        "**Fields:**",
        "- `user`: User's public key",
        "- `previous_staked_amount`: Amount staked before this sync (0 on first sync)",
        "- `new_staked_amount`: Amount staked after this sync (from Streamflow)",
        "- `accrued_rewards`: Rewards accumulated during previous stake period",
        "- `pending_rewards_after`: Total pending rewards (accrued + previous pending)",
        "- `stake_entry_index`: Global reward index when this stake period began",
        "- `timestamp`: Unix timestamp of sync"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "previousStakedAmount",
            "type": "u64"
          },
          {
            "name": "newStakedAmount",
            "type": "u64"
          },
          {
            "name": "accruedRewards",
            "type": "u128"
          },
          {
            "name": "pendingRewardsAfter",
            "type": "u128"
          },
          {
            "name": "stakeEntryIndex",
            "type": "u128"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "userHolderState",
      "docs": [
        "Per-user holder reward claim state with time-weighted staking checkpoints.",
        "Tracks stake periods and accumulated rewards from CIPHER staked via Streamflow.",
        "",
        "**CRITICAL REQUIREMENT:**",
        "Users MUST stake CIPHER via Streamflow to earn holder rewards.",
        "Rewards only accumulate during periods when tokens are actively staked.",
        "",
        "**Checkpoint System:**",
        "- User calls `sync_holder_stake()` after each stake/unstake in Streamflow",
        "- Sync records: entry index, staked amount, pending rewards from previous period",
        "- Claim calculates: pending + (current_index - entry_index) * staked_amount / Q128",
        "",
        "**Time-Weighted Formula:**",
        "```",
        "On sync:",
        "accrued = (current_index - entry_index) * previous_staked_amount / Q128",
        "pending_rewards += accrued  // Preserve from past periods",
        "entry_index = current_index  // Start new period",
        "staked_amount = new_amount   // Update stake",
        "",
        "On claim:",
        "current_period = (current_index - entry_index) * staked_amount / Q128",
        "total_claimable = pending_rewards + current_period",
        "transfer(total_claimable)",
        "pending_rewards = 0",
        "entry_index = current_index",
        "```",
        "",
        "**Security:**",
        "- Self-reported staked amount (validated by frontend against indexer)",
        "- Economic security: Can't drain more than proportional share (vault balance cap)",
        "- First sync initializes with current index (prevents retroactive claims)",
        "- Pending rewards preserve across stake periods (fair accumulation)",
        "",
        "**Integration with Streamflow:**",
        "- Streamflow Program: STAKEvGqQTtzJZH6BWDcbpzXXn2BBerPAgQ3EGLN2GH",
        "- Indexer tracks stakes: GET /api/v1/streamflow/stakes/:owner",
        "- Frontend validates sync amount against indexer (prevents errors)",
        "- No on-chain Streamflow verification (self-reported + economic security)",
        "",
        "PDA Seeds: [b\"holder_user\", user_pubkey]",
        "Size: 160 bytes (~0.142 SOL rent-exempt, paid by user on first sync)"
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stakeEntryIndexQ128",
            "docs": [
              "Reward index when current stake period began",
              "Set on each sync to current global index",
              "Used to calculate rewards accumulated during current period"
            ],
            "type": "u128"
          },
          {
            "name": "pendingRewards",
            "docs": [
              "Accumulated rewards from previous stake periods (unclaimed)",
              "Preserved across syncs to allow multi-period accumulation",
              "Reset to 0 on claim"
            ],
            "type": "u128"
          },
          {
            "name": "totalClaimed",
            "docs": [
              "Total rewards claimed by this user (cumulative, never decreases)",
              "Sum across all periods and claim events",
              "Denominated in quote token (e.g., USDC)"
            ],
            "type": "u128"
          },
          {
            "name": "user",
            "docs": [
              "User this state belongs to"
            ],
            "type": "pubkey"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved space for future upgrades (40 bytes)",
              "Reduced from 64 bytes due to new fields"
            ],
            "type": {
              "array": [
                "u64",
                5
              ]
            }
          },
          {
            "name": "currentStakedAmount",
            "docs": [
              "Current staked CIPHER amount (per last sync)",
              "Updated via `sync_holder_stake()` after each Streamflow stake/unstake",
              "",
              "SECURITY: ON-CHAIN VERIFIED via Streamflow CPI (NOT self-reported)",
              "- Reads actual amount from Streamflow StakeEntry account",
              "- Verifies account owned by Streamflow program",
              "- Validates authority, stake pool, nonce, and active status",
              "- See: sync_holder_stake.rs verify_and_get_stake_amount()"
            ],
            "type": "u64"
          },
          {
            "name": "lastClaimTime",
            "docs": [
              "Last timestamp when user claimed rewards",
              "Used for analytics and monitoring"
            ],
            "type": "i64"
          },
          {
            "name": "lastSyncTime",
            "docs": [
              "Last timestamp when user synced their stake",
              "Used to detect stale state and prompt frontend to sync"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA derivation"
            ],
            "type": "u8"
          },
          {
            "name": "pad",
            "docs": [
              "Additional padding to align struct to 16-byte boundary (Pod requirement)"
            ],
            "type": {
              "array": [
                "u8",
                15
              ]
            }
          }
        ]
      }
    },
    {
      "name": "userNftState",
      "docs": [
        "Per-user NFT reward claim state.",
        "Tracks the last claimed index to calculate pending rewards.",
        "",
        "**Design:**",
        "- Initialized lazily on first claim (saves rent for non-claimers)",
        "- Index-based claiming prevents double-claiming",
        "- No NFT list stored (verifies ownership at claim time)",
        "",
        "**Claiming Formula:**",
        "```",
        "index_delta = current_index - user_last_claimed_index",
        "user_nft_weight = sum(nft_rarities.map(r => r.weight()))",
        "claimable = (index_delta * user_nft_weight) / Q128",
        "```",
        "",
        "**Security:**",
        "- First claim initializes with current index (prevents retroactive claims)",
        "- Index updated after claim (prevents double-claiming same period)",
        "- NFT ownership checked at claim time (prevents borrowed NFT exploits)",
        "- Max 10 NFTs per claim (prevents compute limit issues)",
        "",
        "PDA Seeds: [b\"nft_user\", user_pubkey]",
        "Size: 144 bytes (~0.128 SOL rent-exempt, paid by user on first claim)"
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "docs": [
              "User this state belongs to"
            ],
            "type": "pubkey"
          },
          {
            "name": "lastClaimedIndexQ128",
            "docs": [
              "Last reward index when user claimed",
              "Initialized to current index on first claim (prevents retroactive)"
            ],
            "type": "u128"
          },
          {
            "name": "totalClaimed",
            "docs": [
              "Total rewards claimed by this user (cumulative, never decreases)",
              "Sum across all pools and claim events",
              "Denominated in quote token (e.g., USDC)"
            ],
            "type": "u128"
          },
          {
            "name": "lastClaimTime",
            "docs": [
              "Last timestamp when user claimed",
              "Used for analytics and rate limiting (if desired)"
            ],
            "type": "i64"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved space for future upgrades (64 bytes)",
              "Using u64 array to avoid Pod padding issues"
            ],
            "type": {
              "array": [
                "u64",
                8
              ]
            }
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA derivation"
            ],
            "type": "u8"
          },
          {
            "name": "pad",
            "docs": [
              "Additional padding to reach target size"
            ],
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          }
        ]
      }
    }
  ]
};
