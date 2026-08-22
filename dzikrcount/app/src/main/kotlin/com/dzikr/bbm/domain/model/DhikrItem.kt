package com.dzikr.bbm.domain.model

/**
 * Domain Model defining core entities of a Dhikr loop unit.
 */
data class DhikrItem(
    val id: String,
    val name: String,
    val arabic: String,
    val transliteration: String,
    val translation: String
)
