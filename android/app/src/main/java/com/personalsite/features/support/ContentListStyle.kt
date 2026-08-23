package com.personalsite.features.support

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.personalsite.core.PSColors

/** 内容流列表的共用度量（对齐 iOS ContentListMetrics）。 */
object ContentListMetrics {
    val titleSize = 15.5.sp
    val summarySize = 13.5.sp
    val metadataSize = 11.5.sp
    val rowSpacing = 8.dp
    val rowVerticalInset = 14.dp
    val rowContentMinHeight = 108.dp
    val rowPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp)
}

@Composable
fun ContentListMetadataLine(items: List<String>) {
    Text(
        text = items.filter { it.isNotEmpty() }.joinToString(" · "),
        fontSize = ContentListMetrics.metadataSize,
        fontWeight = FontWeight.Medium,
        color = PSColors.quiet,
        maxLines = 1,
    )
}

/** 行内容壳：满宽 + 最小高度（对齐 contentListBody）。 */
fun Modifier.contentListBody(): Modifier = this
    .fillMaxWidth()
    .heightIn(min = ContentListMetrics.rowContentMinHeight)
