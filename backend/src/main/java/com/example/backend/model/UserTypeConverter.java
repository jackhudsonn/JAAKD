package com.example.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.math.BigDecimal;

// Converts between UserType and the numeric column type Supabase actually uses for users.userType.
@Converter(autoApply = false)
public class UserTypeConverter implements AttributeConverter<UserType, BigDecimal> {

    @Override
    public BigDecimal convertToDatabaseColumn(UserType attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public UserType convertToEntityAttribute(BigDecimal dbData) {
        return dbData == null ? null : UserType.fromCode(dbData);
    }
}
