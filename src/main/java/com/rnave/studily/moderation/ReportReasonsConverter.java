package com.rnave.studily.moderation;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Converter
public class ReportReasonsConverter implements AttributeConverter<List<ReportReason>, String> {

    @Override
    public String convertToDatabaseColumn(List<ReportReason> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return "";
        }
        return attribute.stream().map(Enum::name).collect(Collectors.joining(","));
    }

    @Override
    public List<ReportReason> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return List.of();
        }
        return Arrays.stream(dbData.split(",")).map(String::trim).map(ReportReason::valueOf).toList();
    }
}
