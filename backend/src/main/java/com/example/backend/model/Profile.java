package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

// Maps to public.profiles — merged app-user + profile data. Linked to auth.users via Supabase trigger:
// when auth.users row is created, trigger creates profiles row with userID = auth.users.id.
// JWT's 'sub' claim (= auth.users.id) resolves directly to profiles.userID for ownership-scoped queries.
@Entity
@Table(name = "profiles")
public class Profile {

    @Id
    @Column(name = "`userID`")
    private UUID userId;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "`userType`", nullable = false)
    private BigDecimal userType = BigDecimal.ZERO;

    @Column(name = "`firstName`")
    private String firstName;

    @Column(name = "`lastName`")
    private String lastName;

    @Column(name = "city")
    private String city;

    @Column(name = "state")
    private String state;

    @Column(name = "country")
    private String country;

    @Column(name = "`zipCode`")
    private String zipCode;

    @Column(name = "dob")
    private LocalDate dob;

    @Column(name = "avatar")
    private String avatar;

    protected Profile() {
    }

    public Profile(String email) {
        this.email = email;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public BigDecimal getUserType() {
        return userType;
    }

    public void setUserType(BigDecimal userType) {
        this.userType = userType;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getZipCode() {
        return zipCode;
    }

    public void setZipCode(String zipCode) {
        this.zipCode = zipCode;
    }

    public LocalDate getDob() {
        return dob;
    }

    public void setDob(LocalDate dob) {
        this.dob = dob;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }
}
