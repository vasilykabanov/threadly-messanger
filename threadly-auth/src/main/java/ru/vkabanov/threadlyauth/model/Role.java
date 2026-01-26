package ru.vkabanov.threadlyauth.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@NoArgsConstructor
@AllArgsConstructor
public class Role {

    public final static Role USER = new Role("USER");

    private String name;
}

